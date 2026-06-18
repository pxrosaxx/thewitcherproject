require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command) {
        commands.push(command.data.toJSON());
    }
}

if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.error('❌ Brakuje CLIENT_ID lub GUILD_ID w pliku .env. Dopisz je i spróbuj ponownie.');
    process.exit(1);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Rejestruję ${commands.length} komend na serwerze testowym (GUILD_ID)...`);

        const data = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
            body: commands
        });

        console.log(`✅ Zarejestrowano ${data.length} komend: ${data.map((c) => c.name).join(', ')}`);
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }
})();
