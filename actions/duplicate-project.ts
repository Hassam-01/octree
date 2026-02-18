'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Tables, TablesInsert } from '@/database.types';
import { z } from 'zod';

const DuplicateProject = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

export type State = {
  projectId: string | null;
  message?: string | null;
  success?: boolean;
};

export async function duplicateProject(projectId: string): Promise<State> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      redirect('/auth/login');
    }

    const validatedFields = DuplicateProject.safeParse({ projectId });

    if (!validatedFields.success) {
      throw new Error(validatedFields.error.errors[0].message);
    }

    const { projectId: validatedProjectId } = validatedFields.data;

    // Fetch source project (verify ownership)
    const { data: sourceProjectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', validatedProjectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !sourceProjectData) {
      throw new Error(
        'Project not found or you do not have permission to duplicate it'
      );
    }

    const sourceProject = sourceProjectData as Tables<'projects'>;

    // Fetch all files for the source project
    const { data: sourceFilesData, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', validatedProjectId);

    if (filesError) {
      throw new Error('Failed to fetch project files');
    }

    const sourceFiles = (sourceFilesData ?? []) as Tables<'files'>[];

    // Create new project
    const newProjectData: TablesInsert<'projects'> = {
      title: `${sourceProject.title} copy`,
      user_id: user.id,
    };

    const { data: newProject, error: createError } = await (
      supabase.from('projects') as any
    )
      .insert(newProjectData)
      .select()
      .single();

    if (createError || !newProject) {
      throw new Error('Failed to create duplicate project');
    }

    // Copy each file: download from storage, upload to new project, create file record
    if (sourceFiles && sourceFiles.length > 0) {
      for (const file of sourceFiles) {
        const sourcePath = `projects/${validatedProjectId}/${file.name}`;
        const destPath = `projects/${newProject.id}/${file.name}`;

        // Download file from storage
        const { data: fileBlob, error: downloadError } =
          await supabase.storage.from('octree').download(sourcePath);

        if (downloadError || !fileBlob) {
          console.error(`Error downloading file ${file.name}:`, downloadError);
          continue;
        }

        // Upload to new project path
        const { error: uploadError } = await supabase.storage
          .from('octree')
          .upload(destPath, fileBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadError) {
          console.error(`Error uploading file ${file.name}:`, uploadError);
          continue;
        }

        // Get public URL for the new file
        const { data: urlData } = supabase.storage
          .from('octree')
          .getPublicUrl(destPath);

        // Create file record
        const newFileRecord: TablesInsert<'files'> = {
          project_id: newProject.id,
          name: file.name,
          type: file.type,
          size: file.size,
          url: urlData.publicUrl,
        };

        const { error: fileRecordError } = await (
          supabase.from('files') as any
        ).insert(newFileRecord);

        if (fileRecordError) {
          console.error(
            `Error creating file record for ${file.name}:`,
            fileRecordError
          );
        }
      }
    }

    revalidatePath('/');

    return {
      projectId: newProject.id,
      message: null,
      success: true,
    };
  } catch (error) {
    console.error('Error duplicating project:', error);
    return {
      projectId: null,
      message:
        error instanceof Error ? error.message : 'Failed to duplicate project',
      success: false,
    };
  }
}
