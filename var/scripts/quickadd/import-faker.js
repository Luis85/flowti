async function ensureFolderRecursive(path) {
  if (!path) return;
  const segments = path.split("/").filter(Boolean);
  let current = "";
  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg;
    const exists = await app.vault.adapter.exists(current);
    if (!exists) {
      try {
        await app.vault.createFolder(current);
      } catch (e) {
        // Ignorieren, falls Race-Condition / bereits vorhanden
      }
    }
  }
}

module.exports = async (params) => {
  
  const fakerUrl = app.vault.adapter.getResourcePath("var/scripts/faker-importer/faker.js");
  const gensUrl = app.vault.adapter.getResourcePath("var/scripts/faker-importer/faker-gens.js");
  const writerUrl = app.vault.adapter.getResourcePath("var/scripts/faker-importer/faker-writer.js");
  const progressUrl = app.vault.adapter.getResourcePath("var/scripts/utilities/import-progress-modal.js");
  
	const { faker } = await import(fakerUrl);
	const { createGens } = await import(gensUrl);
	const { writeFakerRecords } = await import(writerUrl);
	const { createProgressOverlay } = await import(progressUrl);
	
  const modalFormsPlugin = app.plugins.plugins.modalforms;
  const quickAddPlugin   = app.plugins.plugins.quickadd;

  if (!modalFormsPlugin || !quickAddPlugin) {
    new Notice("Modal Forms and QuickAdd Plugins are required.");
    return;
  }

  const modalForm = modalFormsPlugin.api;
  const defaultValues = {
    dataset_type: "",
    target_folder: "Sandbox/Faker",
    count: 1,
    with_folder_structure: false,
  };

  // Form öffnen mit Defaults
  const formResult = await modalForm.openForm("import-faker", {
    values: defaultValues,
  });

  // Abbruch
  if (!formResult) {
    new Notice("Faker Import canceled.");
    return;
  }

  // Werte lesen + normalisieren
  let datasetType  = (formResult.dataset_type ?? defaultValues.dataset_type).toString().trim();
  const targetFolder = (formResult.target_folder ?? defaultValues.target_folder).toString().trim();
  const countRaw = formResult.count ?? defaultValues.count;
  const withFolderStructure = formResult.with_folder_structure ?? defaultValues.with_folder_structure;

  datasetType = datasetType.toLowerCase();
  const count = Math.max(1, parseInt(countRaw, 10) || defaultValues.count);

 // go get fakes
  const gens = createGens(faker);
  const generator = gens[datasetType];
  if (!generator) {
    new Notice(`unknown dataset_type "${datasetType}".`);
    return;
  }

  // -----------------------------
  // Zielordner vorbereiten
  // -----------------------------
  const baseFolder  = targetFolder.replace(/\/+$/, ""); // trailing Slashes entfernen
  const modelFolder = baseFolder ? `${baseFolder}/${datasetType}` : datasetType;

  await ensureFolderRecursive(modelFolder);

  // -----------------------------
  // Records erzeugen & Files schreiben
  // -----------------------------
  const created = await writeFakerRecords({
    app,
    faker,
    datasetType,
    modelFolder,
    count,
    generator,
    withFolderStructure,
  });

  // -----------------------------
  // Summary
  // -----------------------------
  new Notice(
    `Faker Import: ${created} "${datasetType}"-Files in "${modelFolder}" created.`
  );

  return {
    dataset_type: datasetType,
    target_folder: modelFolder,
    count: created,
  };
};
