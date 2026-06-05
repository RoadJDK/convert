import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ConvertApp from "./islands/ConvertApp";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <ConvertApp />
  </TooltipProvider>
);

export default App;
