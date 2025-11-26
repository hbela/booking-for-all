import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Calendar, CreditCard } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function OwnerHomepage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-500/10 mb-6">
              <Building2 className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Organization Owner Portal
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Manage your organizations, departments, providers, and subscriptions all in one place
            </p>
          </div>

          {/* Image Section */}
          <div className="mb-12 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=600&fit=crop"
              alt="Organization Management"
              className="w-full h-[400px] object-cover"
            />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader>
                <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
                <CardTitle>Organization Control</CardTitle>
                <CardDescription>
                  Manage your organizations, departments, and team members with ease
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
                <CardTitle>Provider Management</CardTitle>
                <CardDescription>
                  Add and manage service providers, set schedules, and track availability
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CreditCard className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription>
                  Monitor subscriptions, manage billing, and ensure your organization stays active
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Access your organization dashboard and management tools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Link to="/owner">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    <Building2 className="mr-2 h-4 w-4" />
                    Go to Owner Dashboard
                  </Button>
                </Link>
                <Link to="/owner/departments">
                  <Button variant="outline" size="lg">
                    <Users className="mr-2 h-4 w-4" />
                    Manage Departments
                  </Button>
                </Link>
                <Link to="/owner/providers">
                  <Button variant="outline" size="lg">
                    <Calendar className="mr-2 h-4 w-4" />
                    Manage Providers
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

