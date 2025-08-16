// ======== استدعاء المكتبات ========
const { Client, GatewayIntentBits, Partials, EmbedBuilder, Collection } = require('discord.js');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const express = require('express');
const app = express();

// ======== إعداد البوت ========
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

// ======== أوامر السلاش ========
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

// ======== تسجيل أوامر السلاش ========
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slashCommands });
    console.log('✅ تم تسجيل أوامر السلاش');
  } catch (error) {
    console.error(error);
  }
})();

// ======== عند تشغيل البوت ========
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} جاهز للعمل`);
  client.user.setActivity('dev by mostro');
});

// ======== دالة حماية الرتب ========
function canInteract(executor, target, guild) {
  if (executor.id === guild.ownerId) return true;
  const me = guild.members.me || guild.members.cache.get(client.user.id);
  if (!me) return false;

  if (executor.roles.highest.position <= target.roles.highest.position && executor.id !== guild.ownerId) return false;
  if (me.roles.highest.position <= target.roles.highest.position) return false;

  return true;
}

// ======== تحويل مدة التايم أوت ========
function parseDuration(input) {
  const match = input.match(/^[0-9]+[mhd]$/);
  if (!match) return null;
  const amount = parseInt(input);
  const unit = input.slice(-1);
  const multipliers = { m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}

// ======== التعامل مع أوامر السلاش ========
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;
  const guild = interaction.guild;
  const targetUser = options.getUser('user');
  const member = targetUser ? guild.members.cache.get(targetUser.id) : null;

  try {
    if (['ban','kick','timeout','untimeout','role'].includes(commandName)) {
      if (!member) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو.', ephemeral: true });
      if (!canInteract(interaction.member, member, guild)) return interaction.reply({ content: '⚠️ لا يمكنك تنفيذ الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.', ephemeral: true });
    }

    switch (commandName) {
      case 'help':
        return interaction.reply({ embeds: [new EmbedBuilder()
          .setTitle('📋 قائمة الأوامر')
          .setColor(0x2b2d31)
          .setDescription('**أوامر سلاش:** /ban /kick /timeout /untimeout /unban /role /help\n**أوامر نصية:** !ban !kick !timeout !untimeout !unban !role !help')
          .setFooter({ text:'Mostro Bot | dev by mostro', iconURL: client.user.displayAvatarURL() })]
        });

      case 'ban': {
        const reason = options.getString('reason') || 'بدون سبب';
        await member.ban({ reason });
        return interaction.reply(`✅ تم حظر ${targetUser.tag} | السبب: ${reason}`);
      }

      case 'kick': {
        const reason = options.getString('reason') || 'بدون سبب';
        await member.kick(reason);
        return interaction.reply(`✅ تم طرد ${targetUser.tag} | السبب: ${reason}`);
      }

      case 'timeout': {
        const durationStr = options.getString('duration');
        const reason = options.getString('reason') || 'بدون سبب';
        const durationMs = parseDuration(durationStr);
        if (!durationMs) return interaction.reply({ content: '⚠️ صيغة المدة غير صحيحة', ephemeral: true });
        await member.timeout(durationMs, reason);
        return interaction.reply(`✅ تم إعطاء تايم لـ ${targetUser.tag} لمدة ${durationStr} | السبب: ${reason}`);
      }

      case 'untimeout':
        await member.timeout(null);
        return interaction.reply(`✅ تم إزالة التايم عن ${targetUser.tag}`);

      case 'unban': {
        const userId = options.getString('userid');
        try {
          await guild.members.unban(userId);
          return interaction.reply(`✅ تم فك الحظر عن <@${userId}>`);
        } catch {
          return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو المحظور.', ephemeral: true });
        }
      }

      case 'role': {
        const roleInput = options.getString('role');
        const role = guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput.replace(/[^0-9]/g,''));
        if (!role) return interaction.reply({ content:'⚠️ لم أتمكن من العثور على الرتبة.', ephemeral:true });

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          return interaction.reply(`✅ تمت إزالة الرتبة ${role.name} من ${targetUser.tag}`);
        } else {
          await member.roles.add(role);
          return interaction.reply(`✅ تم إعطاء الرتبة ${role.name} إلى ${targetUser.tag}`);
        }
      }
    }
  } catch(err) {
    console.error(err);
    interaction.reply({ content:'❌ حدث خطأ أثناء تنفيذ الأمر.', ephemeral:true });
  }
});

// ======== التعامل مع الأوامر النصية ========
client.on('messageCreate', async msg => {
  if (!msg.guild || msg.author.bot || !msg.content.startsWith('!')) return;
  const args = msg.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
  const executor = msg.member;

  if (!member && !['unban','help'].includes(command)) return msg.reply('⚠️ الرجاء منشن العضو أو كتابة آيدي صحيح.');

  if (['ban','kick','timeout','untimeout','role'].includes(command)) {
    if (!canInteract(executor, member, msg.guild)) return msg.reply('⚠️ لا يمكنك تنفيذ الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.');
  }

  try {
    switch(command){
      case 'help':
        msg.reply({ embeds: [new EmbedBuilder()
          .setTitle('📋 قائمة الأوامر')
          .setColor(0x2b2d31)
          .setDescription('**أوامر سلاش:** /ban /kick /timeout /untimeout /unban /role /help\n**أوامر نصية:** !ban !kick !timeout !untimeout !unban !role !help')
          .setFooter({ text:'Mostro Bot | dev by mostro', iconURL: client.user.displayAvatarURL() })]
        });
        break;

      case 'ban': {
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        await member.ban({ reason });
        msg.reply(`✅ تم حظر ${member.user.tag} | السبب: ${reason}`);
        break;
      }

      case 'kick': {
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        await member.kick(reason);
        msg.reply(`✅ تم طرد ${member.user.tag} | السبب: ${reason}`);
        break;
      }

      case 'timeout': {
        const duration = args[1];
        const reason = args.slice(2).join(' ') || '
        const durationMs = parseDuration(duration);
        if (!durationMs || durationMs < 60000 || durationMs > 2419200000)
          return msg.reply('⚠️ الرجاء تحديد مدة بين 1 دقيقة و28 يوم مثل: `10m`, `2h`, `3d`');
        await member.timeout(durationMs, reason);
        msg.reply(`✅ تم إعطاء تايم لـ ${member.user.tag} لمدة ${duration} | السبب: ${reason}`);
        break;
      }

      case 'untimeout': {
        await member.timeout(null);
        msg.reply(`✅ تم إزالة التايم عن ${member.user.tag}`);
        break;
      }

      case 'unban': {
        const input = args[0];
        if (!input) return msg.reply('⚠️ الرجاء إدخال آيدي العضو.');
        try {
          await msg.guild.members.unban(input);
          msg.reply(`✅ تم فك الحظر عن <@${input}>`);
        } catch (err) {
          console.error(err);
          msg.reply('❌ لم أتمكن من العثور على العضو المحظور.');
        }
        break;
      }

      case 'role': {
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
    }
  } catch (err) {
    console.error(err);
    msg.reply('❌ حدث خطأ أثناء تنفيذ الأمر.');
  }
});

// ======== تسجيل دخول البوت ========
client.login(process.env.TOKEN);

// ======== Web Server لتشغيل البوت 24/7 ========
app.get('/', (req, res) => {
  res.send('البوت شغال ✅');
});

app.listen(3000, () => {
  console.log('🌐 Web Server يعمل على المنفذ 3000');
});

