import { ArrowRight, BarChart3, Calendar, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function HomePage() {
  const tools = [
    {
      title: 'Exam Duty Assignment',
      description:
        'Automatically assign faculty to examination duties using constraint-based algorithms.',
      path: '/assignment',
      icon: Calendar,
      features: [
        'Constraint-based assignment',
        'Excel import/export',
        'Offline functionality',
      ],
      color: 'bg-red-50 border-red-200 dark:bg-red-900/50 dark:border-red-800',
      iconColor: 'text-red-600',
    },
    {
      title: 'Duty Attendance Marking',
      description:
        'Mark and track faculty attendance during examination duties.',
      path: '/attendance',
      icon: ClipboardCheck,
      features: [
        'Digital attendance tracking',
        'Absence reporting',
        'Excel export',
      ],
      color:
        'bg-orange-50 border-orange-200 dark:bg-orange-900/50 dark:border-orange-800',
      iconColor: 'text-orange-600',
      incomplete: true,
    },
    {
      title: 'Faculty Duty Accumulation',
      description:
        'End-of-year analysis and accumulation of faculty duty distribution.',
      path: '/accumulation',
      icon: BarChart3,
      features: [
        'Multi-exam analysis',
        'Fair distribution calculation',
        'Annual reports',
      ],
      color:
        'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/50 dark:border-yellow-800',
      iconColor: 'text-yellow-600',
      incomplete: true,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 lg:flex lg:h-[calc(100vh-9.15rem)] lg:items-center">
      {/* Tools Grid */}
      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.path}
              className={`relative ${tool.color} transition-shadow hover:shadow-lg`}
            >
              <CardHeader>
                <div className="mb-3 flex items-center gap-3">
                  <Icon className={`size-8 ${tool.iconColor}`} />
                  <CardTitle className="text-xl">{tool.title}</CardTitle>
                </div>
                <CardDescription className="text-base">
                  {tool.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Key Features:</h4>
                  <ul className="space-y-1">
                    {tool.features.map((feature, index) => (
                      <li
                        key={index}
                        className="text-muted-foreground flex items-center gap-2 text-sm"
                      >
                        <div className="size-1.5 rounded-full bg-current" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  asChild={!tool.incomplete}
                  className="w-full"
                  disabled={tool.incomplete}
                >
                  <Link to={tool.path}>
                    {tool.incomplete ? (
                      'Coming Soon'
                    ) : (
                      <>
                        Open Tool
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
