
import React from 'react';

// This is a special layout for the print page.
// It does not include the main dashboard sidebar or navigation,
// ensuring a clean slate for printing.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
