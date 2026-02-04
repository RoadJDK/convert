const getTimeGreeting = (): string => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 10) {
    return 'Guete Morge';
  } else if (hour >= 10 && hour < 12) {
    return 'Schöne Vormittag';
  } else if (hour >= 12 && hour < 14) {
    return 'E Guete';
  } else if (hour >= 14 && hour < 17) {
    return 'Schöne Nami';
  } else if (hour >= 17 && hour < 21) {
    return 'Schöne Abe';
  } else {
    // 21:00 - 04:59
    return 'Willkomme';
  }
};

export const Greeting = () => {
  const greeting = getTimeGreeting();

  return (
    <div className="text-center">
      <span className="text-lg font-medium text-foreground">
        {greeting} 👋
      </span>
    </div>
  );
};
