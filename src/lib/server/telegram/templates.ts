// Every Telegram message text lives here.
export const templates = {
	demoPing: (pingId: string) => `Проверка очереди: демо-задача ${pingId} выполнена.`,
	unknownRequest: (rawName: string, contact: string | null) =>
		`Гостя нет в списке: ${rawName}\nКонтакт: ${contact ?? 'не указан'}`
};
