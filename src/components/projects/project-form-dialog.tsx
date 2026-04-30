import { Check } from 'lucide-react';

import { useEffect, useState } from 'react';

import type { Project, ProjectColor, SemesterParity } from '@/types';
import { PROJECT_COLORS } from '@/types';

import {
  PROJECT_COLOR_CLASSES,
  randomProjectColor,
  resolveProjectColor,
} from '@/lib/project-colors';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

export interface ProjectFormValues {
  title: string;
  semesterParity: SemesterParity;
  notes: string;
  color: ProjectColor;
  setActive?: boolean;
}

interface ProjectFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  // For edit mode, the existing project to pre-populate from.
  initial?: Project | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProjectFormValues) => Promise<void> | void;
  // When true, show the "set as active project" checkbox (create mode only by
  // default, but exposed so callers can override).
  showSetActive?: boolean;
}

export function ProjectFormDialog({
  open,
  mode,
  initial,
  onOpenChange,
  onSubmit,
  showSetActive,
}: ProjectFormDialogProps) {
  const [title, setTitle] = useState('');
  const [semesterParity, setSemesterParity] = useState<SemesterParity>('even');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<ProjectColor>('blue');
  const [setActive, setSetActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setTitle(initial.title);
      setSemesterParity(initial.semesterParity);
      setNotes(initial.notes);
      setColor(resolveProjectColor(initial));
    } else {
      setTitle('');
      setSemesterParity('even');
      setNotes('');
      setColor(randomProjectColor());
      setSetActive(true);
    }
  }, [open, mode, initial]);

  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0 && !submitting;
  const showActiveToggle = showSetActive ?? mode === 'create';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmed,
        semesterParity,
        notes,
        color,
        setActive: showActiveToggle ? setActive : undefined,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New Exam Project' : 'Edit Project'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Group all phases of an exam (assignment, attendance, renumeration) under a single project.'
              : 'Update the project title, semester, or notes. Renaming will update the slug.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">Title</Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid-Sem Spring 2026"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Semester</Label>
            <RadioGroup
              value={semesterParity}
              onValueChange={(v) => setSemesterParity(v as SemesterParity)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="sem-even" value="even" />
                <Label htmlFor="sem-even" className="font-normal">
                  Even Semester
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="sem-odd" value="odd" />
                <Label htmlFor="sem-odd" className="font-normal">
                  Odd Semester
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => {
                const classes = PROJECT_COLOR_CLASSES[c];
                const selected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={classes.label}
                    aria-pressed={selected}
                    className={cn(
                      'relative flex size-8 items-center justify-center rounded-full transition-transform',
                      classes.swatch,
                      selected
                        ? 'ring-foreground ring-offset-background scale-110 ring-2 ring-offset-2'
                        : 'hover:scale-105'
                    )}
                  >
                    {selected && (
                      <Check className="size-4 text-white drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-notes">Notes</Label>
            <Textarea
              id="project-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Here are some notes to myself about this project..."
              rows={4}
            />
          </div>

          {showActiveToggle && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="set-active"
                checked={setActive}
                onCheckedChange={(checked) => setSetActive(checked === true)}
              />
              <Label htmlFor="set-active" className="font-normal">
                Set as Active Project
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {mode === 'create' ? 'Create Project' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
