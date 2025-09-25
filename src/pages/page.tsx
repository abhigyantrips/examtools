import {
  ArrowRight,
  BarChart3,
  Calendar,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
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
        'Automatically assign faculty to examination hall duties using constraint-based algorithms',
      path: '/assignment',
      icon: Calendar,
      features: [
        'Constraint-based assignment',
        'Excel import/export',
        'Offline functionality',
      ],
      color: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Duty Attendance Marking',
      description:
        'Mark and track faculty attendance during examination duties',
      path: '/attendance',
      icon: ClipboardCheck,
      features: [
        'Digital attendance tracking',
        'Absence reporting',
        'Excel export',
      ],
      color: 'bg-green-50 border-green-200',
      iconColor: 'text-green-600',
      badge: 'Coming Soon',
    },
    {
      title: 'Faculty Duty Accumulation',
      description:
        'End-of-year analysis and accumulation of faculty duty distribution',
      path: '/accumulation',
      icon: BarChart3,
      features: [
        'Multi-exam analysis',
        'Fair distribution calculation',
        'Annual reports',
      ],
      color: 'bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
      badge: 'Coming Soon',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold">Exam Tools</h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
          Comprehensive examination management tools for universities. Automate
          duty assignments, track attendance, and ensure fair faculty
          distribution.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border p-6 text-center">
          <Users className="mx-auto mb-3 size-12 text-blue-600" />
          <div className="text-2xl font-bold">177+</div>
          <div className="text-muted-foreground text-sm">Faculty Supported</div>
        </div>
        <div className="rounded-lg border p-6 text-center">
          <Clock className="mx-auto mb-3 size-12 text-green-600" />
          <div className="text-2xl font-bold">15×</div>
          <div className="text-muted-foreground text-sm">Slot Combinations</div>
        </div>
        <div className="rounded-lg border p-6 text-center">
          <FileSpreadsheet className="mx-auto mb-3 size-12 text-purple-600" />
          <div className="text-2xl font-bold">100%</div>
          <div className="text-muted-foreground text-sm">Offline Capable</div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.path}
              className={`relative ${tool.color} transition-shadow hover:shadow-lg`}
            >
              {tool.badge && (
                <div className="absolute top-4 right-4 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                  {tool.badge}
                </div>
              )}

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
                  asChild
                  className="w-full"
                  variant={tool.badge ? 'secondary' : 'default'}
                  disabled={!!tool.badge}
                >
                  <Link to={tool.path}>
                    {tool.badge ? (
                      tool.badge
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

      {/* Footer Info */}
      <div className="bg-muted/30 mt-16 rounded-lg border p-8 text-center">
        <h3 className="mb-2 font-semibold">Built for Universities</h3>
        <p className="text-muted-foreground mx-auto max-w-2xl text-sm">
          Designed specifically for university examination departments. Works
          offline, handles complex constraints, and exports data in familiar
          Excel formats.
        </p>
      </div>
    </div>
  );
}
