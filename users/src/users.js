import { faker } from '@faker-js/faker';

const USERS_COUNT = 100;
let store = {};

export async function seedUsers(force = false) {
    if (!force && Object.keys(store).length) return;
    faker.seed(123);
    store = {};
    for (let i = 0; i < USERS_COUNT; i++) {
        const uuid = faker.string.uuid();
        store[uuid] = {
            uuid,
            pseudo: faker.internet.username(),
            prenom: faker.person.firstName(),
            nom: faker.person.lastName(),
            email: faker.internet.email()
        };
    }
    console.log(`Generated ${USERS_COUNT} users.`);
}

async function getUsers(req, res) {
    await seedUsers();
    res.status(200).send(Object.keys(store));
}

async function getUser(req, res) {
    await seedUsers();
    const user = store[req.params.uuid];
    if (!user) return res.status(404).send({ error: 'User not found' });
    res.status(200).send(user);
}

export default { getUsers, getUser };
