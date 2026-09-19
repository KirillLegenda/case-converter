import * as vscode from 'vscode';
import { extractVariables, convert, NamingStyle } from './converter';

// Точка входа расширения. Здесь регистрируется команда, которая будет доступна
// из палитры команд VS Code и выполняет конвертацию стилей именования.
export function activate(context: vscode.ExtensionContext) {
	
	console.log('Congratulations, your extension "case-converter" is now active!');

	// Регистрируем команду case-converter.convertStyles. Она запускается пользователем,
	// открывает список доступных стилей и меняет имена всех найденных переменных.
	const disposable = vscode.commands.registerCommand('case-converter.convertStyles', async () => {
		const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

		// В список попадают все поддерживаемые стили. Этот набор используется в quick pick.
		const items = Object.values(NamingStyle).filter(style => style !== NamingStyle.Unknown);

        // Фиксируем документ, выделение и базовое смещение ДО открытия QuickPick,
        // пока фокус и выделение не сбросились
        const document = editor.document;
        const selection = editor.selection;
        const hasSelection = !selection.isEmpty;

		// Пользователь выбирает, в какой стиль нужно перевести имена переменных.
		const text = hasSelection ? document.getText(selection) : document.getText();
        const baseOffset = hasSelection ? document.offsetAt(selection.start) : 0;

        // Пользователь выбирает, в какой стиль нужно перевести имена переменных.
        const selectedNewType = await vscode.window.showQuickPick(
            items, 
            {
                placeHolder: "Укажите новый стиль"
            }
        );

        if (!selectedNewType) {
            return;
        }
        
		// Получаем все имена переменных, параметров и свойств из документа.
		// Эти имена используются для последующего поиска в тексте и замены.
		const knownVariables = await getAllVariableNames(document);

		// Из текста извлекаются только те идентификаторы, которые присутствуют в knownVariables.
		const tokens = extractVariables(text, knownVariables);

		if (tokens.length === 0) {
			vscode.window.showInformationMessage('Переменные не найдены.');
			return;
		}

		let newStyle: NamingStyle = selectedNewType as NamingStyle;
        // Заменяем токены справа налево, чтобы изменения длины идентификаторов
        // не влияли на позиции следующих замен.
        tokens.sort((left, right) => right.posStart - left.posStart);

		// Выполняем изменения документа в одну транзакцию: каждая найденная переменная
		// заменяется на новое имя с учетом выбранного стиля.
		editor.edit(editBuilder => {
			tokens.forEach(token =>{
				let newName = convert(token.name, newStyle);
                // Прибавляем baseOffset к координатам токена
				const startPos = document.positionAt(token.posStart + baseOffset);
				const endPos = document.positionAt(token.posEnd + baseOffset);
				const range = new vscode.Range(startPos, endPos);
				editBuilder.replace(range, newName);
			});
		}).then(success => {
			if (success){
				vscode.window.showInformationMessage(`Готово! Изменено слов: ${tokens.length}`);
			} else{
				vscode.window.showErrorMessage("Произошла ошибка");
			}
		});
	});

	context.subscriptions.push(disposable);
}


// Данный метод получает все имена идентификаторов документа, которые были
// распознаны языковым сервером VS Code как переменные, параметры или свойства.
// Это позволяет изменять только реальные имена, а не случайные слова из текста.
async function getAllVariableNames(document: vscode.TextDocument): Promise<Set<string>> {
    const variableNames = new Set<string>();

    // 1. Получаем таблицу типов семантических токенов. Она нужна, чтобы понимать,
    // какие индексы в массиве данных соответствуют переменным, параметрам и свойствам.
    const legend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
        'vscode.provideDocumentSemanticTokensLegend',
        document.uri
    );

    // 2. Получаем сами семантические токены всего документа.
    const semanticTokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        'vscode.provideDocumentSemanticTokens',
        document.uri
    );

    if (!legend || !semanticTokens || !semanticTokens.data) {
        return variableNames;
    }

    // Выбираем только нужные типы токенов: переменные, параметры и свойства.
    const targetTypes = new Set<number>();
    ['variable', 'parameter', 'property'].forEach(type => {
        const idx = legend.tokenTypes.indexOf(type);
        if (idx !== -1) {
            targetTypes.add(idx);
        }
    });

    const data = semanticTokens.data;
    let currentLine = 0;
    let currentChar = 0;

    // В Semantic Tokens данные идут блоками по 5 чисел:
    // [deltaLine, deltaStartChar, length, tokenType, tokenModifiers]
    // Поэтому цикл идёт с шагом 5 и пересчитывает позицию каждого токена.
    for (let i = 0; i < data.length; i += 5) {
        const deltaLine = data[i];
        const deltaStartChar = data[i + 1];
        const length = data[i + 2];
        const tokenType = data[i + 3];

        currentLine += deltaLine;
        currentChar = deltaLine === 0 ? currentChar + deltaStartChar : deltaStartChar;

        if (targetTypes.has(tokenType)) {
            const range = new vscode.Range(
                currentLine, currentChar,
                currentLine, currentChar + length
            );
            const varName = document.getText(range);
            if (varName) {
                variableNames.add(varName);
            }
        }
    }

    return variableNames;
}

// Вызывается при деактивации расширения.
export function deactivate() {}

