import { getUserData } from './UserRegistration';

const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 10) {
    return 'Guete Morge';
  } else if (hour >= 10 && hour < 12) {
    return 'Schöne Vormittag';
  } else if (hour >= 12 && hour < 14) {
    return 'Guete Mittag';
  } else if (hour >= 14 && hour < 17) {
    return 'Schöne Namittag';
  } else if (hour >= 17 && hour < 21) {
    return 'Schöne Abig';
  } else {
    // 21:00 - 04:59
    return 'Gueti Nacht';
  }
};

export const Greeting = () => {
  const userData = getUserData();
  const greeting = getTimeGreeting();
  const firstName = userData?.firstName || 'Gast';

  return (
    <div className="text-center">
      <span className="text-lg font-medium text-foreground">
        {greeting}, {firstName} 👋
      </span>
    </div>
  );
};
