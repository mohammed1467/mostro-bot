// 📁 index.js
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField, Collection } = require('discord.js');
const fs = require('fs');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const express = require('express');
const app = express();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

//✅ تسجيل أوامر السلاش
const slashCommands = [
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('السبب (اختياري)')),

  new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('السبب (اختياري)')),

  new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('المدة مثل: 10m أو 2h أو 3d').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('السبب (اختياري)')),

  new SlashCommandBuilder().setName('untimeout').setDescription('إلغاء التايم أوت')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true)),

  new SlashCommandBuilder().setName('unban').setDescription('إلغاء البان')
    .addStringOption(opt => opt.setName('userid').setDescription('آيدي العضو').setRequired(true)),

  new SlashCommandBuilder().setName('role').setDescription('أعطاء أو إزالة رتبة')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('role').setDescription('الرتبة (اسم أو منشن أو آيدي)').setRequired(true))
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: slashCommands }
    );
    console.log('✅ Logged in as: Mostro.Bot#7410');
    console.log('🟢 Slash commands registered.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('ready', () => {
  client.user.setActivity('dev by mostro');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;

  try {
    const target = options.getUser('user');
    const member = interaction.guild.members.cache.get(target?.id);

    switch (commandName) {
      case 'ban': {
        const reason = options.getString('reason') || 'بدون سبب';
        if (!member) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو.', ephemeral: true });
        await member.ban({ reason });
        return interaction.reply(`🔨 تم حظر ${target.tag} | السبب: ${reason}`);
      }

      case 'kick': {
        const reason = options.getString('reason') || 'بدون سبب';
        if (!member) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو.', ephemeral: true });
        await member.kick(reason);
        return interaction.reply(`👢 تم طرد ${target.tag} | السبب: ${reason}`);
      }

      case 'timeout': {
        const durationStr = options.getString('duration');
        const reason = options.getString('reason') || 'بدون سبب';
        const durationMs = parseDuration(durationStr);
        if (!durationMs || durationMs < 60000 || durationMs > 2419200000)
          return interaction.reply({ content: '⚠️ الرجاء تحديد مدة بين 1 دقيقة و28 يوم مثل: `10m`, `2h`, `3d`', ephemeral: true });
        await member.timeout(durationMs, reason);
        return interaction.reply(`⏳ تم توقيت ${target.tag} لمدة ${durationStr} | السبب: ${reason}`);
      }

      case 'untimeout':
        if (!member) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو.', ephemeral: true });
        await member.timeout(null);
        return interaction.reply(`✅ تم إزالة التوقيت عن ${target.tag}`);

      case 'unban': {
        const userId = options.getString('userid');
        try {
          await interaction.guild.members.unban(userId);
          return interaction.reply(`✅ تم فك الحظر عن <@${userId}>`);
        } catch {
          return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو المحظور.', ephemeral: true });
        }
      }

      case 'role': {
        const roleInput = options.getString('role');
        const role = interaction.guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput.replace(/[^0-9]/g, ''));
        if (!role) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على الرتبة.', ephemeral: true });
        if (!member) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو.', ephemeral: true });

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          return interaction.reply(`❌ تمت إزالة الرتبة ${role.name} من ${target.tag}`);
        } else {
          await member.roles.add(role);
          return interaction.reply(`✅ تم إعطاء الرتبة ${role.name} إلى ${target.tag}`);
        }
      }
    }
  } catch (err) {
    console.error(err);
    interaction.reply({ content: 'حدث خطأ أثناء تنفيذ الأمر.', ephemeral: true });
  }
});

// الرسائل النصية
client.on('messageCreate', async msg => {
  if (!msg.guild || msg.author.bot || !msg.content.startsWith('!')) return;

  const args = msg.content.slice(1).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const member = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
  const duration = args[1];
  const reason = args.slice(2).join(' ').trim() || 'بدون سبب';

  if (!member && !['unban'].includes(command)) return msg.reply('⚠️ الرجاء منشن العضو أو كتابة آيدي صحيح.');

  try {
    switch (command) {
      case 'ban':
        await member.ban({ reason });
        msg.reply(`🔨 تم حظر ${member?.user?.tag || 'عضو غير معروف'} | السبب: ${reason}`);
        break;

      case 'kick':
        await member.kick(reason);
        msg.reply(`👢 تم طرد ${member?.user?.tag || 'عضو غير معروف'} | السبب: ${reason}`);
        break;

      case 'timeout': {
        const durationMs = parseDuration(duration);
        if (!durationMs || durationMs < 60000 || durationMs > 2419200000)
          return msg.reply('⚠️ الرجاء تحديد مدة بين 1 دقيقة و28 يوم مثل: `10m`, `2h`, `3d`');
        await member.timeout(durationMs, reason);
        msg.reply(`⏳ تم توقيت ${member?.user?.tag || 'عضو غير معروف'} لمدة ${duration} | السبب: ${reason}`);
        break;
      }

      case 'untimeout':
        await member.timeout(null);
        msg.reply(`✅ تم إزالة التوقيت عن ${member?.user?.tag || 'عضو غير معروف'}`);
        break;

      case 'unban': {
        const userId = args[0];
        try {
          await msg.guild.members.unban(userId);
          msg.reply(`✅ تم فك الحظر عن <@${userId}>`);
        } catch {
          msg.reply('⚠️ لم أتمكن من العثور على العضو المحظور.');
        }
        break;
      }

      case 'role': {
        const roleInput = args[1];
        const role = msg.guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput.replace(/[^0-9]/g, ''));
        if (!role) return msg.reply('⚠️ لم أتمكن من العثور على الرتبة.');

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          msg.reply(`❌ تمت إزالة الرتبة ${role.name} من ${member?.user?.tag || 'عضو غير معروف'}`);
        } else {
          await member.roles.add(role);
          msg.reply(`✅ تم إعطاء الرتبة ${role.name} إلى ${member?.user?.tag || 'عضو غير معروف'}`);
        }
        break;
      }
    }
  } catch (err) {
    console.error(err);
    msg.reply('❌ حدث خطأ أثناء تنفيذ الأمر.');
  }
});

function parseDuration(input) {
  const match = input.match(/^[0-9]+[mhd]$/);
  if (!match) return null;
  const amount = parseInt(input);
  const unit = input.slice(-1);
  const multipliers = { m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}

client.login(process.env.TOKEN);

// 🌐 Web Server لتشغيل البوت 24/7
app.get('/', (req, res) => {
  res.send('البوت شغال ✅');
});

app.listen(3000, () => {
  console.log('🌐 Web Server يعمل على المنفذ 3000');
});
