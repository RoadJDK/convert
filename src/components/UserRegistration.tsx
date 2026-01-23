import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";

interface UserRegistrationProps {
  onComplete: () => void;
}

export interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  registeredAt: string;
}

const USER_DATA_KEY = "converter_user_data";

export const getUserData = (): UserData | null => {
  const data = localStorage.getItem(USER_DATA_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearUserData = () => {
  localStorage.removeItem(USER_DATA_KEY);
};

export const UserRegistration = ({ onComplete }: UserRegistrationProps) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }

    if (!validateEmail(email)) {
      toast.error("Bitte eine gültige E-Mail-Adresse eingeben");
      return;
    }

    setIsLoading(true);

    try {
      // Create anonymous session for edge function authentication
      const { error } = await supabase.auth.signInAnonymously();
      
      if (error) {
        console.error("Auth error:", error);
        toast.error("Registrierung fehlgeschlagen. Bitte erneut versuchen.");
        return;
      }

      // Store user data in localStorage
      const userData: UserData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        registeredAt: new Date().toISOString(),
      };

      localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
      
      toast.success(`Willkommen, ${firstName}!`);
      onComplete();
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lifted border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Maibach Convert</CardTitle>
          <CardDescription className="text-muted-foreground">
            Kostenloser Bild- & Video-Konverter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium">
                  Vorname
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Max"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={50}
                  className="h-11"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium">
                  Nachname
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Mustermann"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={50}
                  className="h-11"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                E-Mail-Adresse
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="max@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                className="h-11"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird registriert...
                </>
              ) : (
                <>
                  Loslegen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Deine Daten werden nur lokal gespeichert und nicht weitergegeben.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
