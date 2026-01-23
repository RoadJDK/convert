import { getUserData } from './UserRegistration';

const getTimeGreeting = (firstName: string): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 10) {
    return 'Guete Morge';
  } else if (hour >= 10 && hour < 12) {
    return 'Schöne Vormittag';
  } else if (hour >= 12 && hour < 14) {
    return `E Guete, ${firstName}!`;
  } else if (hour >= 14 && hour < 17) {
    return 'Schöne Nami';
  } else if (hour >= 17 && hour < 21) {
    return 'Schöne Abe';
  } else {
    // 21:00 - 04:59
    return `No Wach, ${firstName}?`;
  }
};

export const Greeting = () => {
  const userData = getUserData();
  const firstName = userData?.firstName || 'Gast';
  const greeting = getTimeGreeting(firstName);
  
  // For greetings that already include the name, don't append it again
  const hour = new Date().getHours();
  const includesName = (hour >= 12 && hour < 14) || hour >= 21 || hour < 5;

  return (
    <div className="text-center">
      <span className="text-lg font-medium text-foreground">
        {includesName ? greeting : `${greeting}, ${firstName}`} 👋
      </span>
    </div>
  );
};
