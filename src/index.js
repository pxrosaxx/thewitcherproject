require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const getDbConnection = require('./db');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Wczytujemy wszystkie komendy z folderu commands/
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.warn(`⚠️  Komenda ${file} nie ma wymaganych pól "data"/"execute" - pomijam.`);
    }
}

// Obsługa interakcji (slash commands)
const interactionCreate = require('./events/interactionCreate');
client.on(interactionCreate.name, (...args) => interactionCreate.execute(...args));

client.once(Events.ClientReady, async () => {
    console.log(`Bot zalogowany jako ${client.user.tag}! Wyruszamy na szlak.`);
    console.log(`Załadowano ${client.commands.size} komend: ${[...client.commands.keys()].join(', ')}`);

    try {
        const db = await getDbConnection();
        await db.get('SELECT 1');
        console.log('✅ Baza SQLite podpięta i gotowa do akcji!');
    } catch (err) {
        console.error('Błąd połączenia z bazą:', err);
    }
});

client.login(process.env.DISCORD_TOKEN);
