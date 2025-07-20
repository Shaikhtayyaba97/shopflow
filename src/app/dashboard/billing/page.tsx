import { BillingClient } from '@/components/billing/BillingClient';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

export default function BillingPage() {
    return (
        <div className="container mx-auto py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Billing</CardTitle>
                    <CardDescription>Scan or search for products to create a new sale.</CardDescription>
                </CardHeader>
                <CardContent>
                    <BillingClient />
                </CardContent>
            </Card>
        </div>
    );
}
