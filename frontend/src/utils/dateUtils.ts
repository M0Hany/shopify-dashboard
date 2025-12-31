// Helper function to convert to Cairo time
export const convertToCairoTime = (date: Date): Date => {
  // Format the date in Cairo timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  // Get date parts in Cairo timezone
  const parts = formatter.formatToParts(date);
  const dateParts: { [key: string]: string } = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      dateParts[part.type] = part.value;
    }
  });

  // Construct a new date with Cairo time parts
  const cairoDate = new Date(
    parseInt(dateParts.year),
    parseInt(dateParts.month) - 1, // Month is 0-based in Date constructor
    parseInt(dateParts.day),
    parseInt(dateParts.hour),
    parseInt(dateParts.minute),
    parseInt(dateParts.second)
  );

  return cairoDate;
};

// Calculate days remaining
export const calculateDaysRemaining = (endDate: Date, now: Date): number => {
  // Reset hours to midnight for accurate day calculation
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  
  // Calculate the difference in days
  const diffTime = end.getTime() - current.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

// Calculate progress based on days remaining intervals
export const calculateProgress = (daysLeft: number): number => {
  if (daysLeft <= 0) return 100; // Overdue
  if (daysLeft <= 4) return 80; // High priority
  if (daysLeft <= 8) return 60; // Medium-high priority
  if (daysLeft <= 12) return 40; // Medium priority
  if (daysLeft <= 20) return 20; // Low priority
  return 10; // Very low priority
};

// Format date for display in Cairo timezone
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Cairo'
  }).format(date);
}; 