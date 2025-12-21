import JSZip from 'jszip';
import {
  Banknote,
  Calendar,
  ClipboardCheck,
  Clock,
  FileText,
  Plus,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { type ChangeEvent, useCallback } from 'react';

import type { ExportMetadata } from '@/types';

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';

export function HomePage() {
  const navigate = useNavigate();
  const tools = [
    {
      title: 'Exam Duty Assignment',
      description:
        'Automatically assign faculty using constraint-based algorithms.',
      path: '/assignment',
      icon: Calendar,
      color: 'bg-red-50 border-red-200 dark:bg-red-900/50 dark:border-red-800',
      iconColor: 'text-red-500',
    },
    {
      title: 'Duty Attendance Marking',
      description:
        'Mark and track faculty attendance during examination duties.',
      path: '/attendance',
      icon: ClipboardCheck,
      color:
        'bg-orange-50 border-orange-200 dark:bg-orange-900/50 dark:border-orange-800',
      iconColor: 'text-orange-500',
      incomplete: true,
    },
    {
      title: 'Financial Renumeration',
      description: 'End-of-year analysis and remuneration of faculty duties.',
      path: '/renumeration',
      icon: Banknote,
      color:
        'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/50 dark:border-yellow-800',
      iconColor: 'text-yellow-500',
      incomplete: true,
    },
  ];

  const recentFiles = [
    {
      id: '1',
      name: '2024 Even Semester Mid-Sem',
      timestamp: '2 hours ago',
      type: 'assignment',
    },
    {
      id: '2',
      name: 'Spring 2024 Finals',
      timestamp: '2 days ago',
      type: 'renumeration',
    },
    {
      id: '3',
      name: 'Winter 2023 Supplementary',
      timestamp: '1 week ago',
      type: 'attendance',
    },
    {
      id: '4',
      name: 'Fall 2023 Finals',
      timestamp: '2 months ago',
      type: 'assignment',
    },
    {
      id: '5',
      name: 'Summer 2023 Special',
      timestamp: '5 months ago',
      type: 'renumeration',
    },
  ];

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const promise = (async () => {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);

        const metadataFile = contents.file('internal/metadata.json');
        if (!metadataFile) {
          throw new Error('Invalid export file: metadata.json not found');
        }

        const metadataContent = await metadataFile.async('string');
        const metadata = JSON.parse(metadataContent) as ExportMetadata;

        if (!metadata.type) {
          throw new Error('Invalid metadata: Export type not specified');
        }

        return metadata.type;
      })();

      toast.promise(promise, {
        loading: 'Processing file...',
        success: (type) => {
          navigate(`/edit/${type}`);
          return `Detected ${type} export`;
        },
        error: (err) => {
          console.error('Error processing file:', err);
          return err instanceof Error ? err.message : 'Failed to process file';
        },
      });

      // Reset input
      e.target.value = '';
    },
    [navigate]
  );

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      {/* Tools Row */}
      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.path} to={tool.path} className="block">
              <Card
                className={`group relative ${tool.color} cursor-pointer overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md`}
              >
                <CardHeader className="relative z-10 pb-12">
                  <CardTitle className="tracking-normal">
                    {tool.title}
                  </CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <div className="absolute -right-1 -bottom-12 z-0">
                  <Icon
                    strokeWidth={1.5}
                    className={`size-30 ${tool.iconColor} opacity-20`}
                  />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Files Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Recent Files</h2>
        <ItemGroup className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Upload Card */}
          <Item
            variant="outline"
            asChild
            role="button"
            className="hover:cursor-pointer"
          >
            <a onClick={() => document.getElementById('file-upload')?.click()}>
              <ItemMedia variant="default" className="translate-y-0!">
                <div className="bg-foreground/10 flex size-14 items-center justify-center rounded-md">
                  <Plus className="text-muted-foreground size-7" />
                </div>
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="text-base">Edit New File</ItemTitle>
                <ItemDescription>
                  Attach a{' '}
                  <code className="bg-muted/50 rounded-md px-1 py-0.5">
                    .zip
                  </code>{' '}
                  file to get started!
                </ItemDescription>
              </ItemContent>
              <input
                id="file-upload"
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileSelect}
              />
            </a>
          </Item>

          {/* Recent Files Cards */}
          {recentFiles.map((file) => {
            const tool = tools.find((t) => t.path.includes(file.type));
            const Icon = tool ? tool.icon : FileText;
            const iconColor = tool ? tool.iconColor : 'text-primary';
            const bgColor = tool ? tool.color : 'bg-muted';

            return (
              <Item key={file.id} variant="outline" asChild role="listitem">
                <Link to={`/edit/${file.type}`}>
                  <ItemMedia variant="default" className="translate-y-0!">
                    <div
                      className={`${bgColor} flex size-14 items-center justify-center rounded-md`}
                    >
                      <Icon
                        className={`size-7 ${file.type === 'renumeration' ? '-rotate-45' : ''} ${iconColor} opacity-75`}
                      />
                    </div>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-base">{file.name}</ItemTitle>
                    <ItemDescription className="flex flex-row items-center gap-1 capitalize">
                      <Clock className="size-3" />
                      {file.timestamp}
                    </ItemDescription>
                  </ItemContent>
                </Link>
              </Item>
            );
          })}
        </ItemGroup>
      </div>
    </div>
  );
}
