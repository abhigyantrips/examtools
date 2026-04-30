import { Banknote, Calendar, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { ProjectsSection } from '@/components/projects/projects-section';

export function HomePage() {
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
    },
    {
      title: 'Financial Renumeration',
      description: 'End-of-year analysis and remuneration of faculty duties.',
      path: '/renumeration',
      icon: Banknote,
      color:
        'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/50 dark:border-yellow-800',
      iconColor: 'text-yellow-500',
    },
  ];

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
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

      <ProjectsSection />
    </div>
  );
}
