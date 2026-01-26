import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type RoleEntry = {
  id: string;
  name: string;
  rate: number;
};

export function AdditionalInfoPhase() {
  const [roles, setRoles] = useState<RoleEntry[]>([]);

  const addRole = () => {
    setRoles((r) => [
      ...r,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: '',
        rate: 0,
      },
    ]);
  };

  const updateRole = (id: string, patch: Partial<RoleEntry>) => {
    setRoles((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeRole = (id: string) => {
    setRoles((r) => r.filter((x) => x.id !== id));
  };

  const totalRoles = useMemo(() => roles.length, [roles]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Roles & Rates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Define extra roles that faculty can be assigned for duties and the
            per-duty rate for each role.
          </p>

          <div className="space-y-3">
            {roles.length === 0 && (
              <div className="text-muted-foreground text-sm">
                No roles defined yet.
              </div>
            )}

            {roles.map((role) => (
              <div key={role.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-muted-foreground text-xs">Role</label>
                  <Input
                    value={role.name}
                    onChange={(e) =>
                      updateRole(role.id, { name: e.target.value })
                    }
                    placeholder="e.g. Invigilator, Head Examiner"
                    className="mt-1"
                  />
                </div>

                <div className="w-40">
                  <label className="text-muted-foreground text-xs">
                    Rate (₹)
                  </label>
                  <Input
                    type="number"
                    value={String(role.rate)}
                    onChange={(e) =>
                      updateRole(role.id, { rate: Number(e.target.value || 0) })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <Button
                    variant="destructive"
                    onClick={() => removeRole(role.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Total roles: {totalRoles}
            </div>
            <div className="flex gap-2">
              <Button onClick={addRole}>Add role</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
