'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FeatureList } from '@/app/onboarding/components/feature-list';
import { createCheckoutSession } from '@/lib/requests/subscription';
import { createClient } from '@/lib/supabase/client';

interface PaywallDialogProps {
  userEmail?: string;
}

export function PaywallDialog({ userEmail }: PaywallDialogProps) {
  const router = useRouter();
  const [isMonthly, setIsMonthly] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubscribe = async () => {
    setIsSubmitting(true);
    try {
      const checkoutUrl = await createCheckoutSession({
        annual: isMonthly,
        withTrial: false,
      });
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      toast.error('Failed to start checkout. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <Dialog open={true} modal>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Subscribe to Octree</DialogTitle>
          <DialogDescription>
            Upgrade to continue using Octree's features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Switch
              id="monthly-switch"
              checked={isMonthly}
              onCheckedChange={setIsMonthly}
            />
            <Label
              htmlFor="monthly-switch"
              className="cursor-pointer text-sm font-normal"
            >
              Save 50% with monthly billing
            </Label>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold">{isMonthly ? '$2.49' : '$4.99'}</p>
              <p className="text-sm text-muted-foreground">per week</p>
            </div>
            {isMonthly && (
              <p className="text-xs text-muted-foreground">Billed monthly at $9.99/month</p>
            )}
            {!isMonthly && (
              <p className="text-xs text-muted-foreground">Billed weekly</p>
            )}
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold">Octree Pro includes</p>
            <FeatureList />
          </div>

          <Button
            className="w-full"
            variant="gradient"
            onClick={handleSubscribe}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Loading...' : 'Subscribe Now'}
          </Button>

          {userEmail && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <p>Signed in as {userEmail}</p>
              <Button
                variant="link"
                size="sm"
                onClick={handleLogout}
                className="h-auto p-0 text-xs"
              >
                Logout
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
