import { format } from 'date-fns';
import {
  CheckCircle2,
  CircleDotDashed,
  Clock,
  FileUp,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { type ChangeEvent, useCallback, useRef, useState } from 'react';

import type { Project } from '@/types';

import { importZipAsDraftProject } from '@/lib/project-import';
import {
  type ToolKind,
  projectAvailableFor,
  unmetRequirementLabel,
} from '@/lib/projects-db';

import { useProjectCapabilities } from '@/hooks/use-project-capabilities';
import { useProjects } from '@/hooks/use-projects';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

import {
  ProjectFormDialog,
  type ProjectFormValues,
} from './project-form-dialog';
import { ProjectIcon } from './project-icon';

interface ConfirmDelete {
  project: Project;
}

export function ProjectsSection() {
  const navigate = useNavigate();
  const {
    projects,
    activeProjectId,
    loading,
    create,
    update,
    remove,
    setActive,
  } = useProjects();
  const { capabilityFor } = useProjectCapabilities();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete | null>(
    null
  );
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          { setActive: values.setActive }
        );
        toast.success(`Project "${project.title}" created`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to create project'
        );
      }
    },
    [create]
  );

  const handleEdit = useCallback(
    async (values: ProjectFormValues) => {
      if (!editTarget) return;
      try {
        await update(editTarget.id, {
          title: values.title,
          semesterParity: values.semesterParity,
          notes: values.notes,
          color: values.color,
        });
        toast.success('Project updated');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update project'
        );
      }
    },
    [update, editTarget]
  );

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      await remove(confirmDelete.project.id);
      toast.success(`Project "${confirmDelete.project.title}" deleted`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete project'
      );
    } finally {
      setConfirmDelete(null);
    }
  }, [confirmDelete, remove]);

  const onImportZip = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setImporting(true);
      try {
        const { project } = await importZipAsDraftProject(file);
        toast.success(
          `Imported "${file.name}" as draft. Open a tool to continue.`
        );
        // After importing, jump straight into the assignment tool by default.
        // The user can pick a different tool from the home page if they want.
        void project;
        navigate('/assignment');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to import ZIP'
        );
      } finally {
        setImporting(false);
      }
    },
    [navigate]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Your Exams</h2>
          <p className="text-muted-foreground text-sm">
            Each project stores data for the assignment, attendance, and
            renumeration phases of one exam.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={onImportZip}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <FileUp className="mr-1 size-4" /> Import ZIP
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" /> New Project
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading projects…</div>
      ) : projects.length === 0 ? (
        <Card className="mt-8 border-dashed ring-0 border-2 bg-transparent shadow-none">
          <CardContent className="flex items-center justify-center gap-4 py-8">
            <div className="bg-muted/50 text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-full">
              <FolderOpen className="size-7" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-foreground/80 text-lg font-medium">
                No Projects Yet
              </p>
              <p className="text-muted-foreground text-sm">
                Create a project to start organizing data for an exam, or import
                an existing ZIP to recover state.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const caps = capabilityFor(project.id);
            const tools: Array<{ tool: ToolKind; label: string; route: string }> = [
              { tool: 'assignment', label: 'Open in Assignment', route: '/assignment' },
              { tool: 'attendance', label: 'Open in Attendance', route: '/attendance' },
              { tool: 'renumeration', label: 'Open in Renumeration', route: '/renumeration' },
            ];
            return (
              <Card
                key={project.id}
              >
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <ProjectIcon project={project} size="md" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="truncate text-base">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      <code className="text-muted-foreground">
                        {project.slug}
                      </code>
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Project actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem
                        onClick={() => setActive(project.id)}
                        disabled={isActive}
                      >
                        <CheckCircle2 className="mr-2 size-4" />
                        {isActive ? 'Active Project' : 'Set as Active'}
                      </DropdownMenuItem>
                      {tools.map(({ tool, label, route }) => {
                        const available = projectAvailableFor(caps, tool);
                        const requirement = unmetRequirementLabel(caps, tool);
                        return (
                          <DropdownMenuItem
                            key={tool}
                            disabled={!available}
                            onClick={() => {
                              if (!available) return;
                              setActive(project.id);
                              navigate(route);
                            }}
                          >
                            {available ? <FolderOpen className="mr-2 size-4" /> : <CircleDotDashed className="mr-2 size-4" />}
                            <span className="flex flex-col">{label}
                            {!available && requirement && (
                              <span className="text-muted-foreground mt-0.5 text-[10px] uppercase tracking-wide">
                                {requirement}
                              </span>
                            )}
                            </span>
                            
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditTarget(project)}>
                        <Pencil className="mr-2 size-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setConfirmDelete({ project })}
                        variant="destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize rounded-sm">
                      {project.semesterParity} Semester
                    </Badge>
                    {project.isDraft && <Badge variant="outline" className="rounded-sm">Draft</Badge>}
                    {isActive && <Badge className="rounded-sm">Active</Badge>}
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      Updated{' '}
                      {format(
                        project.updatedAt instanceof Date
                          ? project.updatedAt
                          : new Date(project.updatedAt),
                        'MMM d, yyyy h:mm a'
                      )}
                    </span>
                    {project.notes ? (
                      <HoverCard openDelay={120} closeDelay={80}>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            className="hover:text-foreground hover:bg-accent inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
                            aria-label="Show notes"
                          >
                            <StickyNote className="size-3" />
                            Notes
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent
                          align="end"
                          side="bottom"
                          className="max-w-xs rounded-md border border-accent-foreground/20"
                        >
                          <p className="text-foreground/90 text-sm italic whitespace-pre-wrap">
                            {project.notes}
                          </p>
                        </HoverCardContent>
                      </HoverCard>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProjectFormDialog
        open={createOpen}
        mode="create"
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />
      <ProjectFormDialog
        open={!!editTarget}
        mode="edit"
        initial={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSubmit={handleEdit}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete "{confirmDelete?.project.title}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the project and all its assignment,
              attendance, and renumeration data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
