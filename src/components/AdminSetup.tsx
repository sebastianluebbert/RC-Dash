import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle } from "lucide-react";

export const AdminSetup = () => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user has admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!roleData);
    } catch (error) {
      console.error('Error checking admin status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const makeAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Nicht angemeldet');
      }

      // Add admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'admin',
        });

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Sie sind jetzt Administrator!",
      });

      setIsAdmin(true);
      
      // Redirect to settings after 2 seconds
      setTimeout(() => {
        navigate('/settings');
      }, 2000);
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Lade...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center">Administrator-Zugang aktiv</CardTitle>
            <CardDescription className="text-center">
              Sie haben bereits Administrator-Rechte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => navigate('/settings')} 
              className="w-full"
            >
              Zu den Einstellungen
            </Button>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="w-full"
            >
              Zum Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-center">Administrator-Zugang einrichten</CardTitle>
          <CardDescription className="text-center">
            Sie benötigen Administrator-Rechte, um auf die Einstellungen und Credentials zugreifen zu können.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">Was sind Administrator-Rechte?</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Zugriff auf Server-Konfigurationen</li>
              <li>Verwaltung von API-Credentials</li>
              <li>Kontrolle über alle verschlüsselten Daten</li>
              <li>Volle Zugriffskontrolle auf die Anwendung</li>
            </ul>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Wichtig:</strong> Vergeben Sie Administrator-Rechte nur an vertrauenswürdige Personen!
            </p>
          </div>

          <Button 
            onClick={makeAdmin} 
            className="w-full"
            size="lg"
          >
            <Shield className="mr-2 h-4 w-4" />
            Administrator werden
          </Button>

          <Button 
            onClick={() => navigate('/')} 
            variant="outline"
            className="w-full"
          >
            Zurück zum Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
