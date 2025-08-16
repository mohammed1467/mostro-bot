// 📁 index.js
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
  partials: [Partials.Channel],
});

client.commands = new Collection();

// ====== دالة لتحويل مدة التايم ======
function parseDuration(input) {
  const match = input.match(/^(\d+)([mhd])$/);
  if (!match) return null;
  const amount = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}

// ====== حماية الرتب ======
function canInteract(executor, target, guild) {
  if (executor.id === guild.ownerId) return true;
  const me = guild.members.me || guild.members.cache.get(client.user.id);
  if (!me) return false;
  if (executor.roles.highest.position <= target.roles.highest.position && executor.id !== guild.ownerId) return false;
  if (me.roles.highest.position <= target.roles.highest.position) return false;
  return true;
}

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
    .addStringOption(opt => opt.setName('duration').setDescription('10m / 2h / 3d').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('السبب (اختياري)')),
  new SlashCommandBuilder().setName('untimeout').setDescription('إلغاء التايم أوت')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder().setName('unban').setDescription('إلغاء البان')
    .addStringOption(opt => opt.setName('userid').setDescription('آيدي العضو').setRequired(true)),
  new SlashCommandBuilder().setName('role').setDescription('أعطاء أو إزالة رتبة')
    .addUserOption(opt => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(opt => opt.setName('role').setDescription('الرتبة (اسم أو منشن أو آيدي)').setRequired(true)),
  new SlashCommandBuilder().setName('say').setDescription('البوت يرسل رسالة')
    .addStringOption(opt => opt.setName('message').setDescription('الرسالة').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('عرض قائمة الأوامر'),
];

// ====== تسجيل أوامر السلاش ======
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slashCommands });
    console.log('✅ تم تسجيل الدخول والبوت جاهز!');
    console.log('🟢 تم تسجيل أوامر السلاش.');
  } catch (err) {
    console.error(err);
  }
})();

// ====== حالة البوت عند التشغيل ======
client.on('ready', () => {
  client.user.setActivity('dev by mostro');
  console.log(`🌐 البوت جاهز للعمل باسم: ${client.user.tag}`);
});

// ====== التعامل مع أوامر السلاش ======
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;
  const guild = interaction.guild;

  try {
    // الحصول على العضو المستهدف إذا كان موجود
    const targetUser = options.getUser('user');
    const member = targetUser ? guild.members.cache.get(targetUser.id) : null;

    if (['ban','kick','timeout','untimeout','role'].includes(commandName)) {
      if (!member) return interaction.reply({ content: '⚠️ لم أتمكن من العثور على العضو.', ephemeral:true });
      if (!canInteract(interaction.member, member, guild))
        return interaction.reply({ content:'⚠️ لا يمكنك تنفيذ هذا الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.', ephemeral:true });
    }

    switch(commandName){
      case 'ban': {
        const reason = options.getString('reason') || 'بدون سبب';
        await member.ban({ reason });
        return interaction.reply(`🔨 تم حظر ${member.user.tag} | السبب: ${reason}`);
      }
      case 'kick': {
        const reason = options.getString('reason') || 'بدون سبب';
        await member.kick(reason);
        return interaction.reply(`👢 تم طرد ${member.user.tag} | السبب: ${reason}`);
      }
      case 'timeout': {
        const durationStr = options.getString('duration');
        const reason = options.getString('reason') || 'بدون سبب';
        const durationMs = parseDuration(durationStr);
        if(!durationMs || durationMs < 60000 || durationMs > 2419200000)
          return interaction.reply({ content:'⚠️ الرجاء تحديد مدة بين 1 دقيقة و28 يوم مثل: `10m`, `2h`, `3d`', ephemeral:true });
        await member.timeout(durationMs, reason);
        return interaction.reply(`⏳ تم إعطاء تايم لـ ${member.user.tag} لمدة ${durationStr} | السبب: ${reason}`);
      }
      case 'untimeout': {
        await member.timeout(null);
        return interaction.reply(`✅ تم إزالة التايم من ${member.user.tag}`);
      }
      case 'unban': {
        const userId = options.getString('userid');
        try{
          await guild.members.unban(userId);
          return interaction.reply(`✅ تم فك الحظر عن <@${userId}>`);
        }catch{
          return interaction.reply({ content:'⚠️ لم أتمكن من العثور على العضو المحظور.', ephemeral:true });
        }
      }
      case 'role': {
        const roleInput = options.getString('role');
        const role = guild.roles.cache.find(r => r.name === roleInput || r.id === roleInput.replace(/[^0-9]/g,''));
        if(!role) return interaction.reply({ content:'⚠️ لم أتمكن من العثور على الرتبة.', ephemeral:true });
        if(member.roles.cache.has(role.id)){
          await member.roles.remove(role);
          return interaction.reply(`❌ تمت إزالة الرتبة ${role.name} من ${member.user.tag}`);
        }else{
          await member.roles.add(role);
          return interaction.reply(`✅ تم إعطاء الرتبة ${role.name} إلى ${member.user.tag}`);
        }
      }
      case 'say': {
        const msg = options.getString('message');
        if(/@everyone|@here|https?:\/\//gi.test(msg)) return interaction.reply({ content:'❌ لا يمكن إرسال روابط أو منشن عام!', ephemeral:true });
        return interaction.reply(msg);
      }
      case 'help': {
        const embed = new EmbedBuilder()
          .setTitle('📋 قائمة الأوامر')
          .setColor(0x2b2d31)
          .setDescription('**أوامر السلاش:** /ban /kick /timeout /untimeout /unban /role /say /help\n**أوامر نصية:** !ban !kick !timeout !untimeout !unban !role !say !help');
        return interaction.reply({ embeds:[embed], ephemeral:true });
      }
    }
  }catch(err){
    console.error(err);
    interaction.reply({ content:'❌ حدث خطأ أثناء تنفيذ الأمر.', ephemeral:true });
  }
});

// ====== أوامر نصية ======
client.on('messageCreate', async msg=>{
  if(!msg.guild || msg.author.bot || !msg.content.startsWith('!')) return;
  const args = msg.content.slice(1).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  const guild = msg.guild;
  const executor = msg.member;
  const member = msg.mentions.members.first() || guild.members.cache.get(args[0]);

  if(!member && !['unban'].includes(command)) return msg.reply('⚠️ الرجاء منشن العضو أو كتابة آيدي صحيح.');

  try{
    switch(command){
      case 'ban': {
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        if(!canInteract(executor, member, guild)) return msg.reply('⚠️ لا يمكنك تنفيذ هذا الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.');
        await member.ban({ reason });
        return msg.reply(`🔨 تم حظر ${member.user.tag} | السبب: ${reason}`);
      }
      case 'kick': {
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        if(!canInteract(executor, member, guild)) return msg.reply('⚠️ لا يمكنك تنفيذ هذا الأمر على عضو رتبته أعلى أو مساوية لك أو للبوت.');
        await member.kick(reason);
        return msg.reply(`👢 تم طرد ${member.user.tag} | السبب: ${reason}`);
      }
      case 'timeout': {
        const duration = args[1];
        const reason = args.slice(2).join(' ') || 'بدون سبب';
        const durationMs = parseDuration(duration);
        if(!durationMs || durationMs < 60000 || durationMs > 2419200000) return msg.reply('⚠️ الرجاء تحديد مدة بين 1 دقيقة و28 يوم');
        await member.timeout(durationMs, reason);
        return msg.reply(`⏳ تم إعطاء تايم لـ ${member.user.tag} لمدة ${duration} | السبب: ${reason}`);
      }
      case 'untimeout': {
        await member.timeout(null);
        return msg.reply(`✅ تم إزالة التايم من ${member.user.tag}`);
      }
      case 'unban': {
        const userId = args[0];
        if(!userId) return msg.reply('⚠️ الرجاء إدخال آيدي العضو.');
        try{
          await guild.members.unban(userId);
          return msg.reply(`✅ تم فك الحظر عن <@${userId}>`);
        }catch{
          return msg.reply('⚠️ لم أتمكن من العثور على العضو المحظور.');
        }
      }
      case 'role': {
        const roleInput = args[1];
        const role = guild.roles.cache.find(r=>r.name===roleInput||r.id===roleInput.replace(/[^0-9]/g,''));
        if(!role) return msg.reply('⚠️ لم أتمكن من العثور على الرتبة.');
        if(member.roles.cache.has(role.id)){
          await member.roles.remove(role);
          return msg.reply(`❌ تمت إزالة الرتبة ${role.name} من ${member.user.tag}`);
        }else{
          await member.roles.add(role);
          return msg.reply(`✅ تم إعطاء الرتبة ${role.name} إلى ${member.user.tag}`);
        }
      }
      case 'say': {
        const text = args.join(' ');
        if(!text) return msg.reply('⚠️ الرجاء كتابة الرسالة.');
        if(/@everyone|@here|https?:\/\//gi.test(text)) return msg.reply('❌ لا يمكن إرسال روابط أو منشن عام!');
        return msg.channel.send(text);
      }
      case 'help': {
        const embed = new EmbedBuilder()
          .setTitle('📋 قائمة الأوامر')
          .setColor(0x2b2d31)
          .setDescription('**أوامر السلاش:** /ban /kick /timeout /untimeout /unban /role /say /help\n**أوامر نصية:** !ban !kick !timeout !untimeout !unban !role !say !help');
        return msg.reply({ embeds:[embed] });
      }
    }
  }catch(err){
    console.error(err);
    return msg.reply('❌ حدث خطأ أثناء تنفيذ الأمر.');
  }
});

// ====== Web Server لتشغيل البوت 24/7 ======
app.get('/', (req,res)=>res.send('البوت شغال ✅'));
app.listen(process.env.PORT || 3000, ()=>console.log(`🌐 Web Server يعمل على المنفذ ${process.env.PORT || 3000}`));

// ====== تسجيل الدخول للبوت ======
client.login(process.env.TOKEN);
