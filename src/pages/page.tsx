import {
  Banknote,
  Calendar,
  ClipboardCheck,
  Clock,
  FileText,
  Plus,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { type ChangeEvent, useCallback } from 'react';

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
      path: '/accumulation',
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
      name: 'Fall 2024 Mid-Sem',
      timestamp: '2 hours ago',
      type: 'assignment',
    },
    {
      id: '2',
      name: 'Spring 2024 Finals',
      timestamp: '2 days ago',
      type: 'accumulation',
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
      type: 'accumulation',
    },
  ];

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        navigate('/edit');
      }
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
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Upload Card */}
          <Card
            className="bg-muted/30 hover:bg-muted/50 flex cursor-pointer flex-col justify-between transition-colors"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="bg-background mt-1 rounded-md p-2 shadow-sm">
                <Plus className="text-muted-foreground size-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base">New File</CardTitle>
                <CardDescription>Create or upload a new file</CardDescription>
              </div>
            </CardHeader>
            <CardFooter>
              <p className="text-muted-foreground text-xs">
                Supports .zip format
              </p>
            </CardFooter>
            <input
              id="file-upload"
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileSelect}
            />
          </Card>

          {/* Recent Files Cards */}
          {recentFiles.map((file) => (
            <Card
              key={file.id}
              className="flex cursor-pointer flex-col justify-between transition-all hover:shadow-md"
              onClick={() => navigate('/edit')}
            >
              <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                <div className="bg-primary/10 mt-1 rounded-md p-2">
                  <FileText className="text-primary size-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base">{file.name}</CardTitle>
                  <CardDescription className="capitalize">
                    {file.type} Tool
                  </CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="justify-end">
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="size-3" />
                  {file.timestamp}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
