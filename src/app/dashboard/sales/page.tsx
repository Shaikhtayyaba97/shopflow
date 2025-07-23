
import { SalesClient } from '@/components/sales/SalesClient';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

export default function SalesPage() {
    return (
        <div className="container mx-auto py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Sales Report</CardTitle>
                    <CardDescription>View sales records for a selected date range.</CardDescription>
                </CardHeader>
                <CardContent>
                    <SalesClient />
                </CardContent>
            </Card>
        </div>
    );
}
