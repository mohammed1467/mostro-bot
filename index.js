// index.js
const { Client, GatewayIntentBits, Partials, EmbedBuilder, Collection } = require('discord.js');
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
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// ✅ أوامر سلاش
const slashCommands = [
  new SlashCommandBuilder().setName('ban').setDescription('حظر عضو')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('السبب (اختياري)')),

  new SlashCommandBuilder().setName('kick').setDescription('طرد عضو')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('السبب (اختياري)')),

  new SlashCommandBuilder().setName('timeout').setDescription('توقيت مؤقت')
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

// تسجيل أوامر السلاش
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: slashCommands }
    );
    console.log('✅ Logged in as: ' + process.env.BOT_NAME);
    console.log('🟢 Slash commands registered.');
  } catch (error) {
    console.error(error);
  }
})();

// عند تشغيل البوت
client.on('ready', () => {
  client.user.setActivity('dev by mostro');
  console.log(`🌐 ${client.user.tag} جاهز للعمل!`);
});

// دالة حماية رتب
function canInteract(executor, target, guild) {
  if (executor.id === guild.ownerId) return true;
  const me = guild.members.me || guild.members.cache.get(client.user.id);
  if (!me) return false;

  if (executor.roles.highest.position <= target.roles.highest.position && executor.id !== guild.ownerId) return false;
  if (me.roles.highest.position <= target.roles.highest.position) return false;

  return true;
}

// دالة تحويل الوقت
function parseDuration(input) {
  const match = input.match(/^[0-9]+[mhd]$/);
  if (!match) return null;
  const amount = parseInt(input);
  const unit = input.slice(-1);
  const multipliers = { m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}

// ⚡ أوامر سلاش
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;
  const guild = interaction.guild;

  const targetUser = options.getUser('user');
  const member = targetUser ? guild.members.cache.get(targetUser.id) : null;

  if (['ban','kick','timeout','untimeout','role'].includes(commandName)) {
    if (!member) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو.', ephemeral: true });
    if (!canInteract(interaction.member, member, guild)) return interaction.reply({ content: '⚠️ لا يمكنك تنفيذ الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.', ephemeral: true });
  }

  try {
    switch (commandName) {
      case 'help': {
        const embed = new EmbedBuilder()
          .setTitle('📋 قائمة الأوامر')
          .setColor(0x2b2d31)
          .setDescription(`
**أوامر بالسلاش:**
</ban:0> — حظر عضو
</kick:0> — طرد عضو
</timeout:0> — توقيت مؤقت
</untimeout:0> — إزالة التوقيت
</unban:0> — إلغاء الحظر
</role:0> — إعطاء أو إزالة رتبة
/help — عرض هذه القائمة

**أوامر نصية:**
\`!ban\` | \`!kick\` | \`!timeout\` | \`!untimeout\` | \`!unban\` | \`!role\` | \`!help\`
          `)
          .setFooter({ text: 'Mostro Bot | dev by mostro', iconURL: client.user.displayAvatarURL() });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'ban': {
        const reason = options.getString('reason') || 'بدون سبب';
        await member.ban({ reason });
        return interaction.reply(`<a:Banned:1402651303246823425> تم حظر ${targetUser.tag} | السبب: ${reason}`);
      }

      case 'kick': {
        const reason = options.getString('reason') || 'بدون سبب';
        await member.kick(reason);
        return interaction.reply(`<:Kick:1402652191298424892> تم طرد ${targetUser.tag} | السبب: ${reason}`);
      }

      case 'timeout': {
        const durationStr = options.getString('duration');
        const reason = options.getString('reason') || 'بدون سبب';
        const durationMs = parseDuration(durationStr);
        if (!durationMs || durationMs < 60000 || durationMs > 2419200000)
          return interaction.reply({ content: '⚠️ الرجاء تحديد مدة بين 1 دقيقة و28 يوم مثل: `10m`, `2h`, `3d`', ephemeral: true });
        await member.timeout(durationMs, reason);
        return interaction.reply(`<:Timeout:1402650647983030443> تم إعطاء تايم لـ ${targetUser.tag} لمدة ${durationStr} | السبب: ${reason}`);
      }

      case 'untimeout': {
        await member.timeout(null);
        return interaction.reply(`<:Timeout:1402650647983030443> تم إزالة التايم عن ${targetUser.tag}`);
      }

      case 'unban': {
        const userId = options.getString('userid');
        try {
          await guild.members.unban(userId);
          return interaction.reply(`<:warn:1402651669501841539> تم فك الحظر عن <@${userId}>`);
        } catch {
          return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو المحظور.', ephemeral: true });
        }
      }

      case 'role': {
        const roleInput = options.getString('role');
        const role = guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput.replace(/[^0-9]/g,''));
        if (!role) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على الرتبة.', ephemeral: true });

        if (member.roles.cache.has(role.id)) await member.roles.remove(role);
        else await member.roles.add(role);

        return interaction.reply(`✅ تم تعديل رتبة ${role.name} لـ ${targetUser.tag}`);
      }
    }
  } catch(err) {
    console.error(err);
    return interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر.', ephemeral: true });
  }
});

// ⚡ أوامر نصية
client.on('messageCreate', async msg => {
  if (!msg.guild || msg.author.bot || !msg.content.startsWith('!')) return;
  const args = msg.content.slice(1).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  const member = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
  const executor = msg.member;

  if (!member && !['unban','help'].includes(command)) return msg.reply('⚠️ الرجاء منشن العضو أو كتابة آيدي صحيح.');
  if (['ban','kick','timeout','untimeout','role'].includes(command)) {
    if (!canInteract(executor, member, msg.guild)) return msg.reply('⚠️ لا يمكنك تنفيذ الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.');
  }

  try {
    switch(command){
      case 'help':
        msg.reply('📋 استخدم الأوامر النصية أو سلاش لرؤية جميع الأوامر.');
        break;
      case 'ban':
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        await member.ban({ reason });
        msg.reply(`✅ تم حظر ${member.user.tag} | السبب: ${reason}`);
        break;

      case 'kick':
        const kickReason = args.slice(1).join(' ') || 'بدون سبب';
        await member.kick(kickReason);
        msg.reply(`✅ تم طرد ${member.user.tag} | السبب: ${kickReason}`);
        break;

      case 'timeout':
        const durationStr = args[1];
        const durationMs = parseDuration(durationStr);
        const timeoutReason = args.slice(2).join(' ') || 'بدون سبب';
        if (!durationMs || durationMs < 60000 || durationMs > 2419200000)
          return msg.reply('⚠️ الرجاء تحديد مدة بين 1 دقيقة و28 يوم مثل: `10m`, `2h`, `3d`');
        await member.timeout(durationMs, timeoutReason);
        msg.reply(`✅ تم إعطاء تايم لـ ${member.user.tag} لمدة ${durationStr} | السبب: ${timeoutReason}`);
        break;

      case 'untimeout':
        await member.timeout(null);
        msg.reply(`✅ تم إزالة التايم عن ${member.user.tag}`);
        break;

      case 'unban':
        const input = args[0];
        if (!input) return msg.reply('⚠️ الرجاء إدخال آيدي أو منشن العضو.');
        try {
          const bans = await msg.guild.bans.fetch();
          const targetBan = bans.find(ban =>
            ban.user.id === input ||
            ban.user.tag === input ||
            `<@${ban.user.id}>` === input ||
            `<@!${ban.user.id}>` === input
          );
          if (!targetBan) return msg.reply('❌ لم يتم العثور على هذا العضو في قائمة المحظورين.');
          await msg.guild.members.unban(targetBan.user.id);
          msg.reply(`✅ تم فك الحظر عن العضو ${targetBan.user.tag}`);
        } catch (e) {
          console.error(e);
          msg.reply('❌ حدث خطأ أثناء محاولة فك الحظر.');
        }
        break;

      case 'role':
        const roleInput = args[1];
        const role = msg.guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput.replace(/[^0-9]/g,''));
        if (!role) return msg.reply('⚠️ لم أتمكن من العثور على الرتبة.');
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          msg.reply(`✅ تمت إزالة الرتبة ${role.name} من ${member.user.tag}`);
        } else {
          await member.roles.add(role);
          msg.reply(`✅ تم إعطاء الرتبة ${role.name} إلى ${member.user.tag}`);
        }
        break;
    }
  } catch (err) {
    console.error(err);
    msg.reply('❌ حدث خطأ أثناء تنفيذ الأمر.');
  }
});

// 🌐 Web Server لتشغيل البوت 24/7
app.get('/', (req, res) => res.send('البوت شغال ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web Server يعمل على المنفذ ${PORT}`));

client.login(process.env.TOKEN);
