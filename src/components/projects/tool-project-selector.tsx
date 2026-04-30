import { ChevronDown, FileArchive, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { type ChangeEvent, useCallback, useRef, useState } from 'react';

import type { Project } from '@/types';

import { importZipAsDraftProject } from '@/lib/project-import';
import { cn } from '@/lib/utils';

import { useProjects } from '@/hooks/use-projects';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import {
  ProjectFormDialog,
  type ProjectFormValues,
} from './project-form-dialog';
import { ProjectIcon } from './project-icon';

interface ToolProjectSelectorProps {
  // The page-level phase. The selector is editable only when this matches
  // `unlockedOnPhase`; afterwards it acts as a read-only label.
  phase: string;
  unlockedOnPhase: string;
  // Optional filename of the in-memory ZIP, surfaced when the active project
  // is a draft so the user can see what they're working from.
  zipFileName?: string | null;
}

/**
 * Header strap selector for the active project. Sits between the Back and
 * Continue buttons in each tool's navigation row.
 */
export function ToolProjectSelector({
  phase,
  unlockedOnPhase,
  zipFileName,
}: ToolProjectSelectorProps) {
  const navigate = useNavigate();
  const { projects, activeProject, setActive, create } = useProjects();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const isDraft = !!activeProject?.isDraft;
  const unlocked = phase === unlockedOnPhase && !isDraft;

  const onSelect = useCallback(
    async (id: string) => {
      await setActive(id);
      setOpen(false);
    },
    [setActive]
  );

  const handleCreate = useCallback(
    async (values: ProjectFormValues) => {
      try {
        const project = await create(
          {
            title: values.title,
            semesterParity: values.semesterParity,
            notes: values.notes,
            color: values.color,
          },
          { setActive: true }
        );
        toast.success(`Project "${project.title}" created and selected`);
        setOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to create project'
        );
      }
    },
    [create]
  );

  const onImportZip = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setImporting(true);
      try {
        await importZipAsDraftProject(file);
        toast.success(`Imported "${file.name}" as draft`);
        setOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to import ZIP'
        );
      } finally {
        setImporting(false);
      }
    },
    []
  );

  // Render: ZIP-mode -> disabled button with archive icon and filename.
  if (isDraft) {
    return (
      <Button
        variant="outline"
        disabled
        className="h-9 max-w-xs justify-start gap-2 px-2.5 opacity-100"
      >
        <span className="bg-muted flex size-7 items-center justify-center rounded-md">
          <FileArchive className="text-muted-foreground size-4" />
        </span>
        <span className="flex min-w-0 flex-col items-start text-left">
          <span className="text-foreground truncate text-xs font-medium">
            {zipFileName || activeProject?.title || 'Imported ZIP'}
          </span>
          <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
            Working from ZIP
          </span>
        </span>
      </Button>
    );
  }

  const triggerLabel = activeProject ? activeProject.title : 'No Project Selected';

  // No project + locked phase: nothing to switch to, render a static hint so
  // the row stays visually balanced.
  if (!unlocked) {
    return (
      <div className="text-muted-foreground flex h-9 max-w-xs items-center gap-2 rounded-md border border-transparent px-2.5 text-xs">
        {activeProject ? (
          <>
            <ProjectIcon project={activeProject} size="sm" />
            <span className="text-foreground truncate font-medium">
              {triggerLabel}
            </span>
          </>
        ) : (
          <span>No active project</span>
        )}
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={onImportZip}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 max-w-xs justify-start gap-2 px-2.5"
            disabled={importing}
          >
            {activeProject ? (
              <ProjectIcon project={activeProject} size="sm" />
            ) : (
              <span className="bg-muted flex size-7 items-center justify-center rounded-md">
                <Plus className="text-muted-foreground size-4" />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col items-start text-left">
              <span className="text-foreground truncate text-xs font-medium">
                {triggerLabel}
              </span>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                {activeProject ? 'Active Project' : 'Choose a project'}
              </span>
            </span>
            <ChevronDown className="text-muted-foreground ml-1 size-3.5 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="w-72 gap-1 p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="text-muted-foreground px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide">
            Switch Project
          </div>
          {projects.length === 0 ? (
            <div className="text-muted-foreground px-2 py-3 text-xs">
              No saved projects yet.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  active={project.id === activeProject?.id}
                  onSelect={() => onSelect(project.id)}
                />
              ))}
            </div>
          )}
          <div className="bg-border my-1 h-px" />
          <Button
            variant="ghost"
            className="h-8 w-full justify-start px-2 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 size-3.5" /> New Project
          </Button>
          <Button
            variant="ghost"
            className="h-8 w-full justify-start px-2 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <FileArchive className="mr-2 size-3.5" /> Import ZIP
          </Button>
          <div className="bg-border my-1 h-px" />
          <Button
            variant="ghost"
            className="h-8 w-full justify-start px-2 text-xs"
            onClick={() => {
              setOpen(false);
              navigate('/');
            }}
          >
            Manage Projects…
          </Button>
        </PopoverContent>
      </Popover>

      <ProjectFormDialog
        open={createOpen}
        mode="create"
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        showSetActive={false}
      />
    </>
  );
}

function ProjectRow({
  project,
  active,
  onSelect,
}: {
  project: Project;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
        active && 'bg-accent/60'
      )}
    >
      <ProjectIcon project={project} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-xs font-medium">
          {project.title}
        </span>
        <span className="text-muted-foreground block truncate text-[10px]">
          {project.slug}
        </span>
      </span>
      {active && (
        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
          Active
        </span>
      )}
    </button>
  );
}
