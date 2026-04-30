import { format } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  FileUp,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { type ChangeEvent, useCallback, useRef, useState } from 'react';

import type { Project } from '@/types';

import { importZipAsDraftProject } from '@/lib/project-import';

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
  ProjectFormDialog,
  type ProjectFormValues,
} from './project-form-dialog';

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
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">No Projects Yet</CardTitle>
            <CardDescription>
              Create a project to start organizing data for an exam, or import
              an existing ZIP to recover state.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            return (
              <Card
                key={project.id}
                className={
                  isActive
                    ? 'border-primary/40 ring-primary/20 ring-2'
                    : undefined
                }
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="min-w-0 space-y-1">
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
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={() => setActive(project.id)}
                        disabled={isActive}
                      >
                        <CheckCircle2 className="mr-2 size-4" />
                        {isActive ? 'Active Project' : 'Set as Active'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setActive(project.id);
                          navigate('/assignment');
                        }}
                      >
                        <FolderOpen className="mr-2 size-4" />
                        Open in Assignment
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setActive(project.id);
                          navigate('/attendance');
                        }}
                      >
                        <FolderOpen className="mr-2 size-4" />
                        Open in Attendance
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setActive(project.id);
                          navigate('/renumeration');
                        }}
                      >
                        <FolderOpen className="mr-2 size-4" />
                        Open in Renumeration
                      </DropdownMenuItem>
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
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {project.semesterParity} Semester
                    </Badge>
                    {project.isDraft && <Badge variant="outline">Draft</Badge>}
                    {isActive && <Badge>Active</Badge>}
                  </div>
                  {project.notes && (
                    <p className="text-muted-foreground line-clamp-3 text-sm">
                      {project.notes}
                    </p>
                  )}
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Clock className="size-3" />
                    Updated{' '}
                    {format(
                      project.updatedAt instanceof Date
                        ? project.updatedAt
                        : new Date(project.updatedAt),
                      'MMM d, yyyy h:mm a'
                    )}
                  </p>
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
