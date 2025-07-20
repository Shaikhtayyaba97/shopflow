"use client"

import { ProfitReportClient } from '@/components/reports/ProfitReportClient';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from 'lucide-react';

export default function ReportsPage() {
    const { userProfile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && userProfile?.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [userProfile, loading, router]);

    if (loading || userProfile?.role !== 'admin') {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
  
    return (
        <Card>
          <CardHeader>
            <CardTitle>Profit Reports</CardTitle>
            <CardDescription>Analyze your sales and profit over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfitReportClient />
          </CardContent>
        </Card>
    );
}
