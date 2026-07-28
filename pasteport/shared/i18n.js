(() => {
  "use strict";

  const FALLBACK_LOCALE = "pt-BR";

  const TRANSLATIONS = Object.freeze({
    "pt-BR": Object.freeze({
      // modal.js
      "modal.addImage": "Adicionar imagem",
      "modal.description": "Use a imagem da área de transferência ou escolha um arquivo.",
      "modal.closeAriaLabel": "Fechar modal",
      "modal.clipboardTitle": "Área de transferência",
      "modal.loading": "Carregando…",
      "modal.clear": "Limpar",
      "modal.clearConfirm": "Confirmar",
      "modal.historyLoading": "Lendo imagens recentes…",
      "modal.historyListAriaLabel": "Imagens recentes da área de transferência",
      "modal.historyEmptyTitle": "Nenhuma imagem recente",
      "modal.historyEmptyHint": "As próximas imagens copiadas aparecerão aqui.",
      "modal.pasteZoneAriaLabel": "Área de transferência para colar ou arrastar imagens",
      "modal.pasteNow": "Cole outra imagem agora",
      "modal.press": "Pressione",
      "modal.orDrop": "ou arraste imagens para esta área",
      "modal.previewGridAriaLabel": "Pré-visualização da área de transferência",
      "modal.filePlaceholder": "ARQ",
      "modal.pastedPreview": "Prévia da imagem colada {index}",
      "modal.namedPreview": "Prévia de {name}",
      "modal.imageN": "Imagem {index}",
      "modal.fileN": "Arquivo {index}",
      "modal.moreFiles": "Mais {count} arquivos",
      "modal.separator": "ou",
      "modal.selectFromComputer": "Selecionar do computador",
      "modal.privacyNote": "A imagem é processada apenas neste dispositivo.",
      "modal.insertingFromHistory": "Inserindo imagem do histórico…",
      "modal.insertHistoryError": "Não foi possível inserir esta imagem do histórico.",
      "modal.imageRemoved": "Imagem removida do histórico.",
      "modal.removeError": "Não foi possível remover esta imagem.",
      "modal.historyCleared": "Histórico local removido.",
      "modal.clearError": "Não foi possível limpar o histórico.",
      "modal.noClipboardImage": "Nenhuma imagem foi encontrada na área de transferência.",
      "modal.noDroppedImage": "Nenhuma imagem válida foi encontrada nos arquivos arrastados.",
      "modal.processingImage": "Processando imagem…",
      "modal.validatingFiles": "Validando arquivos…",
      "modal.insertError": "Não foi possível inserir a imagem neste campo.",
      "modal.recentImagesOne": "1 imagem recente",
      "modal.recentImagesMany": "{count} imagens recentes",
      "modal.unavailable": "Indisponível",
      "modal.useImageAt": "Usar imagem copiada em {time}",
      "modal.removeImageAt": "Remover imagem copiada em {time}",

      // content-script.js
      "content.historyAccessError": "Não foi possível acessar o histórico da área de transferência.",
      "content.historyNoResponse": "O histórico da área de transferência não respondeu.",
      "content.extensionReloaded": "A extensão foi recarregada. Atualize esta página para reativar o PastePort.",
      "content.noValidImage": "Nenhuma imagem válida foi encontrada.",
      "content.filesSkipped": "{count} arquivo(s) foram ignorados ou rejeitados.",
      "content.nativePickerBlocked": "O navegador bloqueou o seletor nativo. Clique novamente em “{selectFromComputer}”.",
      "content.historyReconstructError": "Não foi possível recuperar esta imagem do histórico.",

      // file-injector.js
      "injector.unknown": "desconhecido",
      "injector.anyImage": "qualquer imagem",
      "injector.acceptError": "Este campo não aceita imagens do tipo {type}.{formats}",
      "injector.acceptedFormats": " Formatos aceitos: {formats}.",
      "injector.inputRemoved": "O campo de upload foi removido da página. Tente abrir o upload novamente.",
      "injector.inputDisabled": "Este campo de upload está desabilitado.",
      "injector.inputInvalid": "O campo de upload original não está mais disponível.",
      "injector.dataTransferUnsupported": "Este navegador não oferece suporte à inserção de arquivos pelo PastePort.",
      "injector.notAnImage": "“{name}” não é uma imagem reconhecida.",
      "injector.limitReached": "O limite de {maxFiles} arquivos foi atingido.",
      "injector.singleFileOnly": "Este campo aceita somente um arquivo.",
      "injector.limitAlreadyReached": "O limite de {maxFiles} arquivos já foi atingido.",
      "injector.assignmentBlocked": "O site ou o navegador bloqueou a inserção dos arquivos.",
      "injector.siteRejected": "O site não aceitou os arquivos inseridos pelo PastePort.",
      "injector.imageAdded": "Imagem adicionada com sucesso.",
      "injector.imagesAdded": "{count} imagens adicionadas com sucesso.",
      "injector.unknownType": "O formato {type} não pôde ser identificado com segurança.",

      // options
      "options.title": "Configurações — PastePort",
      "options.settings": "Configurações",
      "options.tagline": "Cole imagens em campos de upload sem precisar salvá-las antes.",
      "options.behavior": "Comportamento",
      "options.behaviorHint": "Defina quando o PastePort deve aparecer e como os arquivos são inseridos.",
      "options.enable": "Ativar PastePort",
      "options.enableHint": "Intercepta campos de upload compatíveis.",
      "options.onlyImages": "Somente uploads de imagem",
      "options.onlyImagesHint": "Evita campos que declaram aceitar outros tipos de arquivo.",
      "options.dragDrop": "Ativar drag-and-drop",
      "options.dragDropHint": "Permite arrastar imagens para a área de colagem.",
      "options.closeAfterInsert": "Fechar após inserir",
      "options.closeAfterInsertHint": "Fecha o modal automaticamente quando o upload recebe os arquivos.",
      "options.combineExisting": "Combinar arquivos existentes",
      "options.combineExistingHint": "Em campos “multiple”, mantém a seleção atual e adiciona as novas imagens.",
      "options.filesAndAppearance": "Arquivos e aparência",
      "options.filesAndAppearanceHint": "Configure limites, nomes gerados e o tema do modal.",
      "options.maxFiles": "Limite máximo de arquivos",
      "options.defaultFileName": "Nome padrão dos arquivos colados",
      "options.theme": "Tema",
      "options.themeAuto": "Automático",
      "options.themeLight": "Claro",
      "options.themeDark": "Escuro",
      "options.language": "Idioma",
      "options.languageAuto": "Automático ({detected})",
      "options.sites": "Sites",
      "options.sitesHint": "Informe um domínio por linha. Subdomínios também serão considerados.",
      "options.ignoredSites": "Sites ignorados",
      "options.ignoredSitesHint": "O PastePort não registra interceptadores nem injeta o modal nesses domínios.",
      "options.preferNative": "Preferir seletor nativo",
      "options.preferNativeHint": "O comportamento original do upload é mantido nesses sites.",
      "options.advanced": "Avançado",
      "options.advancedHint": "Use o modo de depuração somente ao investigar incompatibilidades.",
      "options.debug": "Modo de depuração",
      "options.debugHint": "Exibe diagnósticos técnicos no console da página, sem registrar imagens.",
      "options.history": "Histórico da área de transferência",
      "options.historyStatusQuerying": "Consultando imagens armazenadas…",
      "options.clearHistory": "Limpar histórico",
      "options.clearHistoryConfirm": "Confirmar limpeza",
      "options.clearHistoryHint": "Clique novamente para remover todas as imagens locais.",
      "options.noImagesStored": "Nenhuma imagem armazenada.",
      "options.clearHistoryError": "Não foi possível limpar o histórico.",
      "options.historyUnavailable": "Histórico indisponível.",
      "options.oneImageStored": "1 imagem armazenada somente neste dispositivo.",
      "options.manyImagesStored": "{count} imagens armazenadas somente neste dispositivo.",
      "options.privacyTitle": "Histórico local e privado",
      "options.privacyText": "O PastePort monitora somente imagens copiadas e mantém as 10 mais recentes no IndexedDB deste dispositivo. Nada é sincronizado ou enviado para servidores.",
      "options.save": "Salvar configurações",
      "options.saving": "Salvando…",
      "options.saved": "Configurações salvas.",
      "options.savedLocally": "Configurações salvas localmente.",
      "options.saveError": "Não foi possível salvar as configurações.",
      "options.loadError": "Não foi possível ler as configurações salvas.",

      // offscreen.js
      "offscreen.clipboardTimeout": "Tempo esgotado ao ler a área de transferência.",
      "offscreen.clipboardBlocked": "O navegador bloqueou a leitura da área de transferência.",
      "offscreen.currentItemError": "Não foi possível ler o item atual da área de transferência.",
      "offscreen.imageNotInHistory": "Esta imagem não está mais no histórico.",
      "offscreen.unknownOperation": "Operação de histórico desconhecida.",
      "offscreen.historyAccessError": "Não foi possível acessar o histórico local.",

      // service-worker.js
      "service.historyAccessError": "Não foi possível acessar o histórico local.",
      "service.offscreenJustification": "Manter localmente a galeria de imagens recentes da área de transferência."
    }),

    "en": Object.freeze({
      // modal.js
      "modal.addImage": "Add image",
      "modal.description": "Use the clipboard image or choose a file.",
      "modal.closeAriaLabel": "Close modal",
      "modal.clipboardTitle": "Clipboard",
      "modal.loading": "Loading…",
      "modal.clear": "Clear",
      "modal.clearConfirm": "Confirm",
      "modal.historyLoading": "Reading recent images…",
      "modal.historyListAriaLabel": "Recent clipboard images",
      "modal.historyEmptyTitle": "No recent images",
      "modal.historyEmptyHint": "Images you copy next will appear here.",
      "modal.pasteZoneAriaLabel": "Clipboard area to paste or drag images",
      "modal.pasteNow": "Paste another image now",
      "modal.press": "Press",
      "modal.orDrop": "or drag images to this area",
      "modal.previewGridAriaLabel": "Clipboard preview",
      "modal.filePlaceholder": "FILE",
      "modal.pastedPreview": "Preview of pasted image {index}",
      "modal.namedPreview": "Preview of {name}",
      "modal.imageN": "Image {index}",
      "modal.fileN": "File {index}",
      "modal.moreFiles": "{count} more files",
      "modal.separator": "or",
      "modal.selectFromComputer": "Select from computer",
      "modal.privacyNote": "The image is processed only on this device.",
      "modal.insertingFromHistory": "Inserting image from history…",
      "modal.insertHistoryError": "Could not insert this image from history.",
      "modal.imageRemoved": "Image removed from history.",
      "modal.removeError": "Could not remove this image.",
      "modal.historyCleared": "Local history removed.",
      "modal.clearError": "Could not clear history.",
      "modal.noClipboardImage": "No image was found in the clipboard.",
      "modal.noDroppedImage": "No valid image was found in the dropped files.",
      "modal.processingImage": "Processing image…",
      "modal.validatingFiles": "Validating files…",
      "modal.insertError": "Could not insert the image into this field.",
      "modal.recentImagesOne": "1 recent image",
      "modal.recentImagesMany": "{count} recent images",
      "modal.unavailable": "Unavailable",
      "modal.useImageAt": "Use image copied at {time}",
      "modal.removeImageAt": "Remove image copied at {time}",

      // content-script.js
      "content.historyAccessError": "Could not access the clipboard history.",
      "content.historyNoResponse": "The clipboard history did not respond.",
      "content.extensionReloaded": "The extension was reloaded. Refresh this page to reactivate PastePort.",
      "content.noValidImage": "No valid image was found.",
      "content.filesSkipped": "{count} file(s) were skipped or rejected.",
      "content.nativePickerBlocked": "The browser blocked the native picker. Click “{selectFromComputer}” again.",
      "content.historyReconstructError": "Could not retrieve this image from history.",

      // file-injector.js
      "injector.unknown": "unknown",
      "injector.anyImage": "any image",
      "injector.acceptError": "This field does not accept {type} images.{formats}",
      "injector.acceptedFormats": " Accepted formats: {formats}.",
      "injector.inputRemoved": "The upload field was removed from the page. Try opening the upload again.",
      "injector.inputDisabled": "This upload field is disabled.",
      "injector.inputInvalid": "The original upload field is no longer available.",
      "injector.dataTransferUnsupported": "This browser does not support file insertion by PastePort.",
      "injector.notAnImage": "“{name}” is not a recognized image.",
      "injector.limitReached": "The limit of {maxFiles} files has been reached.",
      "injector.singleFileOnly": "This field accepts only one file.",
      "injector.limitAlreadyReached": "The limit of {maxFiles} files has already been reached.",
      "injector.assignmentBlocked": "The site or browser blocked the file insertion.",
      "injector.siteRejected": "The site did not accept the files inserted by PastePort.",
      "injector.imageAdded": "Image added successfully.",
      "injector.imagesAdded": "{count} images added successfully.",
      "injector.unknownType": "The {type} format could not be safely identified.",

      // options
      "options.title": "Settings — PastePort",
      "options.settings": "Settings",
      "options.tagline": "Paste images into upload fields without saving them first.",
      "options.behavior": "Behavior",
      "options.behaviorHint": "Choose when PastePort appears and how files are inserted.",
      "options.enable": "Enable PastePort",
      "options.enableHint": "Intercepts compatible upload fields.",
      "options.onlyImages": "Image uploads only",
      "options.onlyImagesHint": "Skips fields that declare they accept other file types.",
      "options.dragDrop": "Enable drag-and-drop",
      "options.dragDropHint": "Lets you drag images into the paste area.",
      "options.closeAfterInsert": "Close after inserting",
      "options.closeAfterInsertHint": "Closes the modal automatically once the upload receives the files.",
      "options.combineExisting": "Combine existing files",
      "options.combineExistingHint": "On “multiple” fields, keeps the current selection and adds the new images.",
      "options.filesAndAppearance": "Files and appearance",
      "options.filesAndAppearanceHint": "Set limits, generated names, and modal theme.",
      "options.maxFiles": "Maximum file limit",
      "options.defaultFileName": "Default name for pasted files",
      "options.theme": "Theme",
      "options.themeAuto": "Auto",
      "options.themeLight": "Light",
      "options.themeDark": "Dark",
      "options.language": "Language",
      "options.languageAuto": "Auto ({detected})",
      "options.sites": "Sites",
      "options.sitesHint": "One domain per line. Subdomains are also matched.",
      "options.ignoredSites": "Ignored sites",
      "options.ignoredSitesHint": "PastePort will not register interceptors or inject the modal on these domains.",
      "options.preferNative": "Prefer native picker",
      "options.preferNativeHint": "The original upload behavior is preserved on these sites.",
      "options.advanced": "Advanced",
      "options.advancedHint": "Use debug mode only when investigating incompatibilities.",
      "options.debug": "Debug mode",
      "options.debugHint": "Shows technical diagnostics in the page console, without logging images.",
      "options.history": "Clipboard history",
      "options.historyStatusQuerying": "Checking stored images…",
      "options.clearHistory": "Clear history",
      "options.clearHistoryConfirm": "Confirm clear",
      "options.clearHistoryHint": "Click again to remove all local images.",
      "options.noImagesStored": "No images stored.",
      "options.clearHistoryError": "Could not clear history.",
      "options.historyUnavailable": "History unavailable.",
      "options.oneImageStored": "1 image stored only on this device.",
      "options.manyImagesStored": "{count} images stored only on this device.",
      "options.privacyTitle": "Local and private history",
      "options.privacyText": "PastePort only monitors copied images and keeps the 10 most recent ones in this device's IndexedDB. Nothing is synced or sent to servers.",
      "options.save": "Save settings",
      "options.saving": "Saving…",
      "options.saved": "Settings saved.",
      "options.savedLocally": "Settings saved locally.",
      "options.saveError": "Could not save settings.",
      "options.loadError": "Could not load saved settings.",

      // offscreen.js
      "offscreen.clipboardTimeout": "Timed out while reading the clipboard.",
      "offscreen.clipboardBlocked": "The browser blocked clipboard reading.",
      "offscreen.currentItemError": "Could not read the current clipboard item.",
      "offscreen.imageNotInHistory": "This image is no longer in history.",
      "offscreen.unknownOperation": "Unknown history operation.",
      "offscreen.historyAccessError": "Could not access local history.",

      // service-worker.js
      "service.historyAccessError": "Could not access local history.",
      "service.offscreenJustification": "Keep the recent clipboard image gallery stored locally."
    }),

    "es": Object.freeze({
      // modal.js
      "modal.addImage": "Añadir imagen",
      "modal.description": "Usa la imagen del portapapeles o elige un archivo.",
      "modal.closeAriaLabel": "Cerrar modal",
      "modal.clipboardTitle": "Portapapeles",
      "modal.loading": "Cargando…",
      "modal.clear": "Limpiar",
      "modal.clearConfirm": "Confirmar",
      "modal.historyLoading": "Leyendo imágenes recientes…",
      "modal.historyListAriaLabel": "Imágenes recientes del portapapeles",
      "modal.historyEmptyTitle": "No hay imágenes recientes",
      "modal.historyEmptyHint": "Las próximas imágenes copiadas aparecerán aquí.",
      "modal.pasteZoneAriaLabel": "Área del portapapeles para pegar o arrastrar imágenes",
      "modal.pasteNow": "Pega otra imagen ahora",
      "modal.press": "Presiona",
      "modal.orDrop": "o arrastra imágenes a esta área",
      "modal.previewGridAriaLabel": "Vista previa del portapapeles",
      "modal.filePlaceholder": "ARC",
      "modal.pastedPreview": "Vista previa de la imagen pegada {index}",
      "modal.namedPreview": "Vista previa de {name}",
      "modal.imageN": "Imagen {index}",
      "modal.fileN": "Archivo {index}",
      "modal.moreFiles": "{count} archivos más",
      "modal.separator": "o",
      "modal.selectFromComputer": "Seleccionar del equipo",
      "modal.privacyNote": "La imagen se procesa solo en este dispositivo.",
      "modal.insertingFromHistory": "Insertando imagen del historial…",
      "modal.insertHistoryError": "No se pudo insertar esta imagen del historial.",
      "modal.imageRemoved": "Imagen eliminada del historial.",
      "modal.removeError": "No se pudo eliminar esta imagen.",
      "modal.historyCleared": "Historial local eliminado.",
      "modal.clearError": "No se pudo limpiar el historial.",
      "modal.noClipboardImage": "No se encontró ninguna imagen en el portapapeles.",
      "modal.noDroppedImage": "No se encontró ninguna imagen válida en los archivos arrastrados.",
      "modal.processingImage": "Procesando imagen…",
      "modal.validatingFiles": "Validando archivos…",
      "modal.insertError": "No se pudo insertar la imagen en este campo.",
      "modal.recentImagesOne": "1 imagen reciente",
      "modal.recentImagesMany": "{count} imágenes recientes",
      "modal.unavailable": "No disponible",
      "modal.useImageAt": "Usar imagen copiada a las {time}",
      "modal.removeImageAt": "Eliminar imagen copiada a las {time}",

      // content-script.js
      "content.historyAccessError": "No se pudo acceder al historial del portapapeles.",
      "content.historyNoResponse": "El historial del portapapeles no respondió.",
      "content.extensionReloaded": "La extensión se recargó. Actualiza esta página para reactivar PastePort.",
      "content.noValidImage": "No se encontró ninguna imagen válida.",
      "content.filesSkipped": "{count} archivo(s) fueron ignorados o rechazados.",
      "content.nativePickerBlocked": "El navegador bloqueó el selector nativo. Haz clic de nuevo en “{selectFromComputer}”.",
      "content.historyReconstructError": "No se pudo recuperar esta imagen del historial.",

      // file-injector.js
      "injector.unknown": "desconocido",
      "injector.anyImage": "cualquier imagen",
      "injector.acceptError": "Este campo no acepta imágenes de tipo {type}.{formats}",
      "injector.acceptedFormats": " Formatos aceptados: {formats}.",
      "injector.inputRemoved": "El campo de subida se eliminó de la página. Intenta abrir la subida de nuevo.",
      "injector.inputDisabled": "Este campo de subida está deshabilitado.",
      "injector.inputInvalid": "El campo de subida original ya no está disponible.",
      "injector.dataTransferUnsupported": "Este navegador no admite la inserción de archivos por PastePort.",
      "injector.notAnImage": "“{name}” no es una imagen reconocida.",
      "injector.limitReached": "Se alcanzó el límite de {maxFiles} archivos.",
      "injector.singleFileOnly": "Este campo solo acepta un archivo.",
      "injector.limitAlreadyReached": "Ya se alcanzó el límite de {maxFiles} archivos.",
      "injector.assignmentBlocked": "El sitio o el navegador bloquearon la inserción de archivos.",
      "injector.siteRejected": "El sitio no aceptó los archivos insertados por PastePort.",
      "injector.imageAdded": "Imagen añadida con éxito.",
      "injector.imagesAdded": "{count} imágenes añadidas con éxito.",
      "injector.unknownType": "No se pudo identificar con seguridad el formato {type}.",

      // options
      "options.title": "Configuración — PastePort",
      "options.settings": "Configuración",
      "options.tagline": "Pega imágenes en campos de subida sin guardarlas antes.",
      "options.behavior": "Comportamiento",
      "options.behaviorHint": "Define cuándo debe aparecer PastePort y cómo se insertan los archivos.",
      "options.enable": "Activar PastePort",
      "options.enableHint": "Intercepta campos de subida compatibles.",
      "options.onlyImages": "Solo subidas de imagen",
      "options.onlyImagesHint": "Evita campos que declaran aceptar otros tipos de archivo.",
      "options.dragDrop": "Activar arrastrar y soltar",
      "options.dragDropHint": "Permite arrastrar imágenes al área de pegado.",
      "options.closeAfterInsert": "Cerrar tras insertar",
      "options.closeAfterInsertHint": "Cierra el modal automáticamente cuando la subida recibe los archivos.",
      "options.combineExisting": "Combinar archivos existentes",
      "options.combineExistingHint": "En campos “multiple”, mantiene la selección actual y añade las nuevas imágenes.",
      "options.filesAndAppearance": "Archivos y apariencia",
      "options.filesAndAppearanceHint": "Configura límites, nombres generados y tema del modal.",
      "options.maxFiles": "Límite máximo de archivos",
      "options.defaultFileName": "Nombre predeterminado para archivos pegados",
      "options.theme": "Tema",
      "options.themeAuto": "Automático",
      "options.themeLight": "Claro",
      "options.themeDark": "Oscuro",
      "options.language": "Idioma",
      "options.languageAuto": "Automático ({detected})",
      "options.sites": "Sitios",
      "options.sitesHint": "Indica un dominio por línea. Los subdominios también se consideran.",
      "options.ignoredSites": "Sitios ignorados",
      "options.ignoredSitesHint": "PastePort no registrará interceptores ni inyectará el modal en estos dominios.",
      "options.preferNative": "Preferir selector nativo",
      "options.preferNativeHint": "En estos sitios se conserva el comportamiento original de subida.",
      "options.advanced": "Avanzado",
      "options.advancedHint": "Usa el modo de depuración solo al investigar incompatibilidades.",
      "options.debug": "Modo de depuración",
      "options.debugHint": "Muestra diagnósticos técnicos en la consola de la página, sin registrar imágenes.",
      "options.history": "Historial del portapapeles",
      "options.historyStatusQuerying": "Consultando imágenes almacenadas…",
      "options.clearHistory": "Limpiar historial",
      "options.clearHistoryConfirm": "Confirmar limpieza",
      "options.clearHistoryHint": "Haz clic de nuevo para eliminar todas las imágenes locales.",
      "options.noImagesStored": "No hay imágenes almacenadas.",
      "options.clearHistoryError": "No se pudo limpiar el historial.",
      "options.historyUnavailable": "Historial no disponible.",
      "options.oneImageStored": "1 imagen almacenada solo en este dispositivo.",
      "options.manyImagesStored": "{count} imágenes almacenadas solo en este dispositivo.",
      "options.privacyTitle": "Historial local y privado",
      "options.privacyText": "PastePort solo monitorea imágenes copiadas y conserva las 10 más recientes en el IndexedDB de este dispositivo. Nada se sincroniza ni se envía a servidores.",
      "options.save": "Guardar configuración",
      "options.saving": "Guardando…",
      "options.saved": "Configuración guardada.",
      "options.savedLocally": "Configuración guardada localmente.",
      "options.saveError": "No se pudo guardar la configuración.",
      "options.loadError": "No se pudo leer la configuración guardada.",

      // offscreen.js
      "offscreen.clipboardTimeout": "Se agotó el tiempo al leer el portapapeles.",
      "offscreen.clipboardBlocked": "El navegador bloqueó la lectura del portapapeles.",
      "offscreen.currentItemError": "No se pudo leer el elemento actual del portapapeles.",
      "offscreen.imageNotInHistory": "Esta imagen ya no está en el historial.",
      "offscreen.unknownOperation": "Operación de historial desconocida.",
      "offscreen.historyAccessError": "No se pudo acceder al historial local.",

      // service-worker.js
      "service.historyAccessError": "No se pudo acceder al historial local.",
      "service.offscreenJustification": "Mantener localmente la galería de imágenes recientes del portapapeles."
    })
  });

  const SUPPORTED_LOCALES = Object.freeze(Object.keys(TRANSLATIONS));

  function normalizeLocale(locale) {
    const value = String(locale || "").trim().toLowerCase();
    if (!value) {
      return null;
    }

    if (TRANSLATIONS[value]) {
      return value;
    }

    const base = value.split(/[-_]/)[0];
    if (TRANSLATIONS[base]) {
      return base;
    }

    for (const supported of SUPPORTED_LOCALES) {
      if (supported.startsWith(`${base}-`) || supported.startsWith(`${base}_`)) {
        return supported;
      }
    }

    return null;
  }

  function detectBrowserLocale() {
    try {
      if (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage) {
        return normalizeLocale(chrome.i18n.getUILanguage()) || FALLBACK_LOCALE;
      }
    } catch (error) {
      // ignore
    }

    try {
      if (typeof navigator !== "undefined") {
        return normalizeLocale(navigator.language || navigator.userLanguage) || FALLBACK_LOCALE;
      }
    } catch (error) {
      // ignore
    }

    return FALLBACK_LOCALE;
  }

  function resolveLocale(preferred) {
    const explicit = normalizeLocale(preferred);
    if (explicit) {
      return explicit;
    }

    return detectBrowserLocale();
  }

  let currentLocale = detectBrowserLocale();

  function setLocale(locale) {
    const resolved = resolveLocale(locale);
    currentLocale = resolved;
    return resolved;
  }

  function getLocale() {
    return currentLocale;
  }

  function getDictionary(locale) {
    return TRANSLATIONS[normalizeLocale(locale) || currentLocale] || TRANSLATIONS[FALLBACK_LOCALE];
  }

  function t(key, interpolations = {}) {
    const dictionary = getDictionary();
    let text = dictionary[key] ?? TRANSLATIONS[FALLBACK_LOCALE][key] ?? key;

    for (const [name, value] of Object.entries(interpolations)) {
      text = text.split(`{${name}}`).join(String(value ?? ""));
    }

    return text;
  }

  function list(values, type = "conjunction") {
    return new Intl.ListFormat(currentLocale, { type }).format(values);
  }

  function dateTime(options = {}) {
    return new Intl.DateTimeFormat(currentLocale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...options
    });
  }

  globalThis.__pastePortI18n = Object.freeze({
    t,
    list,
    dateTime,
    setLocale,
    getLocale,
    resolveLocale,
    normalizeLocale,
    detectBrowserLocale,
    supportedLocales: SUPPORTED_LOCALES,
    fallbackLocale: FALLBACK_LOCALE
  });
})();
