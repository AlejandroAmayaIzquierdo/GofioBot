import { Bot } from "grammy/web";
import Env from "./env";

export async function handleBotUpdate(
  bot: Bot,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  env: Env
): Promise<void> {
  // Example of using Worker KV
  // See https://developers.cloudflare.com/workers/wrangler/workers-kv/
  // and https://developers.cloudflare.com/workers/runtime-apis/kv/
  //
  // await env.BINDING_NAME_1.put('hello', 'world');

  // Example of adding a command handler with [grammY](https://grammy.dev/).
  // See https://grammy.dev/guide/basics.html
  bot.command("start", async (ctx) => {
    await ctx.reply("Choss que paso 😎");
  });

  bot.command("reminders", async (ctx) => {
    const resp = (await env.DB.prepare(
      `SELECT date,desc_text FROM reminders WHERE telegram_id = ${ctx.chatId}`
    ).run()) as D1ResponseWithResult;

    const reminders = resp.results as { date: string; desc_text: string }[];

    if (!reminders || reminders.length === 0) {
      await ctx.reply("No tienes recordatorios");
    }

    let message = "Tus recordatorios:\n";

    reminders.forEach((reminder, index) => {
      const date = new Date(reminder.date);
      const formattedDate = `${date.getDate()}/${
        date.getMonth() + 1
      }/${date.getFullYear()}`;
      message += `${formattedDate}: ${reminder.desc_text}\n`;
    });

    await ctx.reply(message);
  });

  bot.command("delete", async (ctx) => {
    const { message } = ctx;
    if (message?.text) {
      // Extract the date from the message text (assuming it's in the format 'deleted YYYY-MM-DD')
      const commandRegex = /deleted\s+(\d{4}-\d{2}-\d{2})/;
      const match = message.text.match(commandRegex);
      if (match && match[1]) {
        const date = match[1];

        await env.DB.prepare(
          "DELETE FROM reminders WHERE date = ?1 AND telegram_id = ?2"
        )
          .bind(date, ctx.chatId)
          .run();
        await ctx.reply(`Recordatorio Borrado: ${date}`);
      } else {
        await ctx.reply("Formato incorrecto.Usa 'add YYYY-MM-DD Descripción'.");
      }
    } else {
      await ctx.reply(
        "Tienes que usar el formato 'add YYYY-MM-DD Descripción'."
      );
    }
  });

  bot.command("deleteall", async (ctx) => {
    try {
      await env.DB.prepare("DELETE FROM reminders WHERE telegram_id = ?")
        .bind(ctx.chatId)
        .run();
      await ctx.reply("Todos los recordatorios Borrados");
    } catch (err) {
      await ctx.reply(JSON.stringify(err));
    }
  });
  bot.command("add", async (ctx) => {
    const { message } = ctx;
    if (message?.text) {
      // Extract the date from the message text (assuming it's in the format 'add YYYY-MM-DD')
      const commandRegex = /add\s+(\d{4}-\d{2}-\d{2})\s+(.+)/;
      const match = message.text.match(commandRegex);
      if (match && match[1]) {
        const date = match[1];
        const description = match[2];

        await env.DB.prepare(
          "INSERT INTO reminders (telegram_id, date, desc_text) VALUES (?1, ?2, ?3)"
        )
          .bind(ctx.chatId, date, description)
          .run();
        await ctx.reply(`Added date: ${date}`);
      } else {
        await ctx.reply("Formato incorrecto.Usa 'add YYYY-MM-DD Descripción'.");
      }
    } else {
      await ctx.reply(
        "Tienes que usar el formato 'add YYYY-MM-DD Descripción'."
      );
    }
  });
}

type D1ResponseWithResult = D1Response & { results: unknown[] };

export async function handleBotCronEvent(
  bot: Bot,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  env: Env,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ctrl: ScheduledController
): Promise<void> {
  try {
    // Handle worker cron events here
    const currentDate = new Date();
    // const oneDayMillis = 24 * 60 * 60 * 1000; // Milliseconds in a day

    // Calculate the date range for reminders closest to 1 day from the current date
    const startMonth = currentDate.getMonth() + 1;
    const startDay = currentDate.getDate();
    const endMonth = startMonth === 12 ? 1 : startMonth + 1; // Wrap around to January if end month is December
    const endDay = startMonth === 12 && startDay === 31 ? 1 : startDay + 1; // Wrap around to 1st day of next month if current date is December 31

    // Query the database for reminders within the date range
    const query = `
    SELECT telegram_id, date,desc_text
    FROM reminders
    WHERE strftime('%m-%d', date) BETWEEN ? AND ?
  `;
    const resp = (await env.DB.prepare(query)
      .bind(
        `${startMonth.toString().padStart(2, "0")}-${startDay
          .toString()
          .padStart(2, "0")}`,
        `${endMonth.toString().padStart(2, "0")}-${endDay
          .toString()
          .padStart(2, "0")}`
      )
      .run()) as D1ResponseWithResult;

    if (!resp || !resp.success) return;

    const reminders = resp.results as {
      telegram_id: number;
      date: string;
      desc_text: string;
    }[];

    if (reminders.length === 0) return;

    const messages = new Map<number, string>();

    for (const reminder of reminders) {
      const { telegram_id, date, desc_text } = reminder;
      if (messages.has(telegram_id)) {
        const prevText = messages.get(telegram_id);
        const mess = prevText + `\n\nRecordatorio: ${date} ${desc_text}`;
        messages.set(telegram_id, mess);
      } else {
        messages.set(telegram_id, `Recordatorio: ${date} ${desc_text}`);
      }
    }

    for (const message of messages) {
      console.log(message);
      await bot.api.sendMessage(message[0], message[1]);
    }

    //bot.api.sendMessage(1992694297, "Hello, world!");
  } catch (err) {
    console.log(err);
  }
}

export async function handleNonBotRequest(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  req: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  env: Env
): Promise<Response> {
  // Request not having the correct secret token is handled here
  return new Response(null, { status: 403 });
}
