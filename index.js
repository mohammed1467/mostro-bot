const { Client, GatewayIntentBits, Partials, EmbedBuilder, Collection } = require('discord.js');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const express = require('express');
const app = express();

// ====== إعداد البوت ======
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

// ====== أوامر السلاش ======
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
    .addStringOption(opt => opt.setName('role').setDescription('الرتبة (اسم أو منشن أو آيدي)').setRequired(true)),

  new SlashCommandBuilder().setName('help').setDescription('عرض قائمة الأوامر')
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

// ====== حماية الرتب ======
function canInteract(executor, target, guild) {
  if (executor.id === guild.ownerId) return true;
  const me = guild.members.me || guild.members.cache.get(client.user.id);
  if (!me) return false;

  if (executor.roles.highest.position <= target.roles.highest.position && executor.id !== guild.ownerId) return false;
  if (me.roles.highest.position <= target.roles.highest.position) return false;

  return true;
}

// ====== التعامل مع أوامر السلاش ======
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;
  const targetUser = options.getUser('user');
  const member = targetUser ? interaction.guild.members.cache.get(targetUser.id) : null;
  const guild = interaction.guild;

  if (['ban', 'kick', 'timeout', 'untimeout', 'role'].includes(commandName)) {
    if (!member) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو.', ephemeral: true });
    if (!canInteract(interaction.member, member, guild)) {
      return interaction.reply({ content: '⚠️ لا يمكنك تنفيذ الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.', ephemeral: true });
    }
  }

  try {
    switch (commandName) {
      case 'help':
        const embed = new EmbedBuilder()
          .setTitle('📋 قائمة الأوامر')
          .setColor(0x2b2d31)
          .setDescription(`**أوامر بالسلاش:**\n</ban:0> — حظر عضو\n</kick:0> — طرد عضو\n</timeout:0> — توقيت مؤقت\n</untimeout:0> — إزالة التوقيت\n</unban:0> — إلغاء الحظر\n</role:0> — إعطاء أو إزالة رتبة\n/help — عرض هذه القائمة`)
          .setFooter({ text: 'Mostro Bot | dev by mostro', iconURL: client.user.displayAvatarURL() });
        return interaction.reply({ embeds: [embed], ephemeral: true });

      case 'ban':
        const reason = options.getString('reason') || 'بدون سبب';
        await member.ban({ reason });
        return interaction.reply(`<a:Banned:1402651303246823425> تم حظر ${targetUser.tag} | السبب: ${reason}`);

      case 'kick':
        const reasonKick = options.getString('reason') || 'بدون سبب';
        await member.kick(reasonKick);
        return interaction.reply(`<:Kick:1384528883876892794> تم طرد ${targetUser.tag} | السبب: ${reasonKick}`);

      case 'timeout':
        const durationStr = options.getString('duration');
        const reasonTimeout = options.getString('reason') || 'بدون سبب';
        const durationMs = parseDuration(durationStr);
        if (!durationMs || durationMs < 60000 || durationMs > 2419200000)
          return interaction.reply({ content: '⚠️ الرجاء تحديد مدة بين 1 دقيقة و28 يوم مثل: `10m`, `2h`, `3d`', ephemeral: true });
        await member.timeout(durationMs, reasonTimeout);
        return interaction.reply(`<:Timeout:1402650647983030443> تم إعطاء تايم لـ ${targetUser.tag} لمدة ${durationStr} | السبب: ${reasonTimeout}`);

      case 'untimeout':
        await member.timeout(null);
        return interaction.reply(`<:Timeout:1402650647983030443> تم إزالة التايم عن ${targetUser.tag}`);

      case 'unban':
        const userId = options.getString('userid');
        try {
          await interaction.guild.members.unban(userId);
          return interaction.reply(`<:warn:1402651669501841539> تم فك الحظر عن <@${userId}>`);
        } catch {
          return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو المحظور.', ephemeral: true });
        }

      case 'role':
        const roleInput = options.getString('role');
        const role = interaction.guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput.replace(/[^0-9]/g, ''));
        if (!role) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على الرتبة.', ephemeral: true });

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          return interaction.reply(`<:moderator_roles:1394841082797490370> تمت إزالة الرتبة ${role.name} من ${targetUser.tag}`);
        } else {
          await member.roles.add(role);
          return interaction.reply(`<:moderator_roles:1394841082797490370> تم إعطاء الرتبة ${role.name} إلى ${targetUser.tag}`);
        }
    }
  } catch (err) {
    console.error(err);
    interaction.reply({ content: 'حدث خطأ أثناء تنفيذ الأمر.', ephemeral: true });
  }
});

// ====== دالة لتحويل مدة التايم ======
function parseDuration(input) {
  const match = input.match(/^[0-9]+[mhd]$/);
  if (!match) return null;
  const amount = parseInt(input);
  const unit = input.slice(-1);
  const multipliers = { m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}

// ====== Web Server لتشغيل البوت 24/7 ======
app.get('/', (req, res) => res.send('البوت شغال ✅'));
app.listen(process.env.PORT || 3000, () => console.log(`🌐 Web Server يعمل على المنفذ ${process.env.PORT || 3000}`));

// ====== تسجيل الدخول للبوت ======
client.login(process.env.TOKEN);
