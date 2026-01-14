import { faker } from '@faker-js/faker';
let store = {};
const numberOfGroup = 13;

async function seedGroups(force = false) {
    if (!force && Object.keys(store).length) return;
    store = {};
    const userIds = await fetch('http://users/users').then(r => r.json());
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);
    const groupIds = Array.from({ length: numberOfGroup }, () => faker.string.uuid());
    for (const gid of groupIds) {
        store[gid] = { gid, name: faker.company.name(), listUserIds: [], memberCount: 0 };
    }
    for (const userId of shuffled) {
        const randomGroup = groupIds[Math.floor(Math.random() * numberOfGroup)];
        store[randomGroup].listUserIds.push(userId);
        store[randomGroup].memberCount++;
    }
}
export async function listGroups(req, res) {
    await seedGroups();
    res.status(200).send(Object.values(store));
}
export async function getGroup(req, res) {
    await seedGroups();
    const group = store[req.params.id];
    if (!group) return res.status(404).send({ error: 'Group not found' });

    const listUserIds = group.listUserIds || [];
    group.members = [];
    for (const userId of listUserIds) {
        const user = await fetch('http://users/users/' + userId).then(r => r.json());
        group.members.push(user);
    }
    res.status(200).send(group);
}
export async function findGroupById(id) {
    await seedGroups();
    const group = store[id];
    if (!group) return res.status(404).send({ error: 'Group not found' });
    return group;
}