const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Przyciski i modale (np. wybór szkoły w /postac) są obsługiwane
        // bezpośrednio w swoich komendach przez awaitMessageComponent /
        // awaitModalSubmit, więc tutaj zajmujemy się tylko slash commandami.
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.warn(`⚠️  Otrzymano nieznaną komendę: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Błąd podczas wykonywania komendy ${interaction.commandName}:`, error);
            const errorPayload = { content: 'Coś poszło nie tak podczas wykonywania tej komendy...', flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorPayload).catch(() => {});
            } else {
                await interaction.reply(errorPayload).catch(() => {});
            }
        }
    }
};
