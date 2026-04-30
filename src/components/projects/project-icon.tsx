import { Folder } from 'lucide-react';

import type { Project } from '@/types';

import { projectColorClasses } from '@/lib/project-colors';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<Size, { box: string; icon: string }> = {
  sm: { box: 'size-7 rounded-md', icon: 'size-3.5' },
  md: { box: 'size-10 rounded-lg', icon: 'size-5' },
  lg: { box: 'size-14 rounded-xl', icon: 'size-7' },
};

interface ProjectIconProps {
  project: Project;
  size?: Size;
  className?: string;
}

export function ProjectIcon({
  project,
  size = 'md',
  className,
}: ProjectIconProps) {
  const colors = projectColorClasses(project);
  const sizes = SIZE_CLASSES[size];
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        colors.bg,
        sizes.box,
        className
      )}
      aria-hidden
    >
      <Folder className={cn(sizes.icon, colors.fg)} strokeWidth={2} />
    </div>
  );
}
