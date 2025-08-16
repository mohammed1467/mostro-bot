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
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();
client.warns = new Collection();
client.userLevels = new Collection();

// ⬇️ أوامر السلاش
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
  new SlashCommandBuilder().setName('warns').setDescription('عرض تحذيرات العضو')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(false)),
  new SlashCommandBuilder().setName('help').setDescription('عرض قائمة الأوامر')
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slashCommands });
    console.log('✅ تم تسجيل أوامر السلاش.');
  } catch (err) { console.error(err); }
})();

client.on('ready', () => {
  console.log(`✅ تم تسجيل الدخول باسم: ${client.user.tag}`);
  client.user.setActivity('AutoMod & Dev by Mostro');
});

// حماية الرتب
function canInteract(executor, target, guild) {
  if (executor.id === guild.ownerId) return true;
  const me = guild.members.me || guild.members.cache.get(client.user.id);
  if (!me) return false;
  if (executor.roles.highest.position <= target.roles.highest.position && executor.id !== guild.ownerId) return false;
  if (me.roles.highest.position <= target.roles.highest.position) return false;
  return true;
}

// تحويل الوقت
function parseDuration(input){
  const match = input.match(/^[0-9]+[mhd]$/);
  if (!match) return null;
  const amount = parseInt(input);
  const unit = input.slice(-1);
  const multipliers = { m:60000, h:3600000, d:86400000 };
  return amount * multipliers[unit];
}

// AutoMod كلمات ممنوعة وروابط
const forbiddenWords = ['badword1','badword2']; // عدل هنا
const linkRegex = /(https?:\/\/[^\s]+)/g;

client.on('messageCreate', async msg => {
  if (!msg.guild || msg.author.bot) return;

  // AutoMod
  let warnCount = client.warns.get(msg.author.id) || 0;
  if (linkRegex.test(msg.content) || forbiddenWords.some(word => msg.content.toLowerCase().includes(word))) {
    warnCount++;
    client.warns.set(msg.author.id, warnCount);
    await msg.delete().catch(()=>{});
    msg.channel.send(`⚠️ ${msg.author} تم حذف الرسالة التحذير #${warnCount}`);
  }

  // XP/شارات
  let xp = client.userLevels.get(msg.author.id) || 0;
  xp++;
  client.userLevels.set(msg.author.id, xp);

  // أوامر نصية
  if (!msg.content.startsWith('!')) return;
  const args = msg.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
  const duration = args[1];

  if (['ban','kick','timeout','untimeout','role'].includes(command) && member) {
    if (!canInteract(msg.member, member, msg.guild)) {
      return msg.reply('⚠️ لا يمكنك تنفيذ الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.');
    }
  }

  try {
    switch(command){
      case 'help':
        return msg.reply('📋 استخدم الأوامر السلاش أو النصية: !ban, !kick, !timeout, !untimeout, !unban, !role, !warns');
      case 'warns': {
        const target = member || msg.member;
        const count = client.warns.get(target.id) || 0;
        return msg.reply(`${target.user.tag} لديه ${count} تحذيرات`);
      }
      case 'ban': {
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        await member.ban({ reason });
        return msg.reply(`✅ تم حظر ${member.user.tag} | السبب: ${reason}`);
      }
      case 'kick': {
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        await member.kick(reason);
        return msg.reply(`✅ تم طرد ${member.user.tag} | السبب: ${reason}`);
      }
      case 'timeout': {
        const ms = parseDuration(duration);
        const reason = args.slice(2).join(' ') || 'بدون سبب';
        if (!ms || ms < 60000 || ms > 2419200000) return msg.reply('⚠️ مدة غير صحيحة.');
        await member.timeout(ms, reason);
        return msg.reply(`✅ تم إعطاء تايم لـ ${member.user.tag} لمدة ${duration} | السبب: ${reason}`);
      }
      case 'untimeout': {
        await member.timeout(null);
        return msg.reply(`✅ تم إزالة التايم عن ${member.user.tag}`);
      }
      case 'unban': {
        const userId = args[0];
        await msg.guild.members.unban(userId);
        return msg.reply(`✅ تم فك الحظر عن <@${userId}>`);
      }
      case 'role': {
        const roleInput = args[1];
        const role = msg.guild.roles.cache.find(r => r.name===roleInput||r.id===roleInput.replace(/[^0-9]/g,''));
        if (!role) return msg.reply('❌ لم أتمكن من العثور على الرتبة.');
        if (member.roles.cache.has(role.id)) { await member.roles.remove(role); return msg.reply(`✅ تمت إزالة الرتبة ${role.name} من ${member.user.tag}`);}
        else { await member.roles.add(role); return msg.reply(`✅ تم إعطاء الرتبة ${role.name} إلى ${member.user.tag}`);}
      }
    }
  } catch(err){
    console.error(err);
    msg.reply('❌ حدث خطأ أثناء تنفيذ الأمر.');
  }
});

// أوامر السلاش
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;
  const targetUser = options.getUser('user');
  const member = targetUser ? interaction.guild.members.cache.get(targetUser.id) : null;

  if (['ban','kick','timeout','untimeout','role'].includes(commandName) && member) {
    if (!canInteract(interaction.member, member, interaction.guild)) {
      return interaction.reply({ content:'⚠️ لا يمكنك تنفيذ الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.', ephemeral:true });
    }
  }

  try {
    switch(commandName){
      case 'help':
        return interaction.reply({ content:'📋 استخدم الأوامر السلاش أو النصية: /ban, /kick, /timeout, /untimeout, /unban, /role, /warns', ephemeral:true });
      case 'warns': {
        const target = member || interaction.member;
        const count = client.warns.get(target.id) || 0;
        return interaction.reply({ content:`${target.user.tag} لديه ${count} تحذيرات`, ephemeral:true });
      }
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
        const ms = parseDuration(options.getString('duration'));
        const reason = options.getString('reason') || 'بدون سبب';
        if (!ms || ms < 60000 || ms > 2419200000) return interaction.reply({ content:'⚠️ مدة غير صحيحة.', ephemeral:true });
        await member.timeout(ms, reason);
        return interaction.reply(`✅ تم إعطاء تايم لـ ${targetUser.tag} لمدة ${options.getString('duration')} | السبب: ${reason}`);
      }
      case 'untimeout': {
        await member.timeout(null);
        return interaction.reply(`✅ تم إزالة التايم عن ${targetUser.tag}`);
      }
      case 'unban': {
        const userId = options.getString('userid');
        await interaction.guild.members.unban(userId);
        return interaction.reply(`✅ تم فك الحظر عن <@${userId}>`);
      }
      case 'role': {
        const roleInput = options.getString('role');
        const role = interaction.guild.roles.cache.find(r => r.name===roleInput||r.id===roleInput.replace(/[^0-9]/g,''));
        if (!role) return interaction.reply({ content:'❌ لم أتمكن من العثور على الرتبة.', ephemeral:true });
        if (member.roles.cache.has(role.id)) { await member.roles.remove(role); return interaction.reply(`✅ تمت إزالة الرتبة ${role.name} من ${targetUser.tag}`);}
        else { await member.roles.add(role); return interaction.reply(`✅ تم إعطاء الرتبة ${role.name} إلى ${targetUser.tag}`);}
      }
    }
  } catch(err){
    console.error(err);
    interaction.reply({ content:'❌ حدث خطأ أثناء تنفيذ الأمر.', ephemeral:true });
  }
});

// Web server
app.get('/', (req,res)=>res.send('البوت شغال ✅'));
app.listen(3000, ()=>console.log('🌐 Web Server يعمل على المنفذ 3000'));

client.login(process.env.TOKEN);
