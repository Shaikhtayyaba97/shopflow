// scripts/seed-users.js
const admin = require('firebase-admin');
const fs = require('fs');

// IMPORTANT: Path to your Firebase service account key JSON file.
// Download this from your Firebase project settings.
const serviceAccountPath = './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Error: Service account key file not found at ${serviceAccountPath}`);
    console.error('Please download it from your Firebase project settings and place it in the root directory.');
    process.exit(1);
}

const serviceAccount = require(`.${serviceAccountPath}`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

const usersToCreate = [
    {
        phoneNumber: '03363856003',
        password: 'password123',
        role: 'admin',
    },
    {
        phoneNumber: '03110349230',
        password: 'password123',
        role: 'shopkeeper',
    }
];

async function seedUsers() {
    console.log('Starting to seed users...');
    for (const userData of usersToCreate) {
        const { phoneNumber, password, role } = userData;
        const email = `${phoneNumber}@shopflow.com`;

        try {
            // Check if user already exists
            let userRecord;
            try {
                userRecord = await auth.getUserByEmail(email);
                console.log(`User ${email} already exists with UID: ${userRecord.uid}. Skipping creation in Auth.`);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    // Create user in Firebase Authentication
                    userRecord = await auth.createUser({
                        email: email,
                        password: password,
                        emailVerified: true,
                    });
                    console.log(`Successfully created user: ${email} with UID: ${userRecord.uid}`);
                } else {
                    throw error; // Re-throw other errors
                }
            }

            // Create user profile in Firestore
            const userDocRef = db.collection('users').doc(userRecord.uid);
            await userDocRef.set({
                email: email,
                role: role
            });
            console.log(`Successfully created Firestore profile for ${email}`);
        
        } catch (error) {
            console.error(`Error creating user ${email}:`, error.message);
        }
    }
    console.log('User seeding finished.');
}

seedUsers();
