/**
 * Writes Faker records as Markdown files into the vault.
 *
 * @param {object}   opts
 * @param {App}      opts.app                 - Obsidian App
 * @param {object}   opts.faker               - Faker instance
 * @param {string}   opts.datasetType         - e.g. "customer", "test_scenario", ...
 * @param {string}   opts.modelFolder         - target folder, e.g. "Sandbox/Faker/scenarios"
 * @param {number}   opts.count               - number of records to generate
 * @param {Function} opts.generator           - factory function returning a record object
 * @param {boolean}  [opts.withFolderStructure=false]
 *                                             - if true and datasetType ends with "_scenario",
 *                                               create a domain folder & scenario markdown file
 *
 * @returns {Promise<number>} number of created files
 */
export async function writeFakerRecords({
  app,
  faker,
  datasetType,
  modelFolder,
  count,
  generator,
  withFolderStructure = false,
}) {
  let created = 0;
  let progress = null;

  // ---------------------------------
  // Helpers
  // ---------------------------------
  const isScenarioDataset = (type) => typeof type === "string" && type.endsWith("_scenario");

  const slugify = (str) => {
    if (!str) return "untitled";
    return String(str)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/--+/g, "-")
      || "untitled";
  };

  async function ensureFolderExists(folderPath) {
    // Use vault API so it works with nested folders
    const existing = app.vault.getAbstractFileByPath(folderPath);
    if (!existing) {
      await app.vault.createFolder(folderPath);
    }
  }

  function buildScenarioMarkdown(record, indexStr) {
    const lines = [];
    const name = record.name || `Scenario ${indexStr}`;
    const description = record.description || "";

    lines.push(`# ${name}`);
    lines.push("");

    if (description) {
      lines.push(`> ${description}`);
      lines.push("");
    }

    // Basic meta
    lines.push("## Overview");
    lines.push("");
    lines.push(`- **Scenario type:** \`${record.scenario_type ?? "n/a"}\``);
    if (record.domain) {
      lines.push(`- **Domain:** \`${record.domain}\``);
    }
    if (record.lifecycle_stage) {
      lines.push(`- **Lifecycle stage:** \`${record.lifecycle_stage}\``);
    }
    if (record.goal) {
      lines.push(`- **Goal:** ${record.goal}`);
    }
    lines.push("");

    // Type-specific bits (based on your generators)
    // test_scenario / service_scenario / user_scenario / product_scenario etc.
    if (record.primary_actor) {
      lines.push("## Primary actor");
      lines.push("");
      lines.push(`- **Name:** ${record.primary_actor.name}`);
      lines.push(`- **Role:** ${record.primary_actor.role}`);
      lines.push("");
    }

    if (record.primary_user) {
      lines.push("## Primary user");
      lines.push("");
      lines.push(`- **Persona:** ${record.primary_user.persona_name}`);
      lines.push(`- **Role:** ${record.primary_user.role}`);
      lines.push(`- **Need:** ${record.primary_user.need}`);
      lines.push("");
    }

    if (record.customer_segment) {
      lines.push("## Customer segment");
      lines.push("");
      lines.push(`- ${record.customer_segment}`);
      lines.push("");
    }

    if (record.product) {
      lines.push("## Product");
      lines.push("");
      lines.push(`- **SKU:** \`${record.product.sku}\``);
      lines.push(`- **Name:** ${record.product.name}`);
      lines.push(`- **Category:** ${record.product.category}`);
      lines.push(`- **Price:** ${record.product.price} ${record.product.currency}`);
      lines.push("");
    }

    if (record.context) {
      lines.push("## Context");
      lines.push("");
      if (record.context.trigger) {
        lines.push(`- **Trigger:** ${record.context.trigger}`);
      }
      if (record.context.channel) {
        lines.push(`- **Channel:** ${record.context.channel}`);
      }
      if (Array.isArray(record.context.preconditions) && record.context.preconditions.length) {
        lines.push("- **Preconditions:**");
        record.context.preconditions.forEach((p) => lines.push(`  - ${p}`));
      }
      if (Array.isArray(record.context.postconditions) && record.context.postconditions.length) {
        lines.push("- **Postconditions:**");
        record.context.postconditions.forEach((p) => lines.push(`  - ${p}`));
      }
      lines.push("");
    }

    if (Array.isArray(record.lanes) && record.lanes.length) {
      lines.push("## Lanes");
      lines.push("");
      record.lanes.forEach((lane) => lines.push(`- ${lane}`));
      lines.push("");
    }

    // SIPOC
    if (record.sipoc) {
      const { suppliers, inputs, process_steps, outputs, customers } = record.sipoc;
      lines.push("## SIPOC");
      lines.push("");

      if (Array.isArray(suppliers) && suppliers.length) {
        lines.push("**Suppliers**");
        suppliers.forEach((s) => lines.push(`- ${s}`));
        lines.push("");
      }

      if (Array.isArray(inputs) && inputs.length) {
        lines.push("**Inputs**");
        inputs.forEach((i) => lines.push(`- ${i}`));
        lines.push("");
      }

      if (Array.isArray(process_steps) && process_steps.length) {
        lines.push("**Process steps**");
        process_steps.forEach((step) => lines.push(`- ${step}`));
        lines.push("");
      }

      if (Array.isArray(outputs) && outputs.length) {
        lines.push("**Outputs**");
        outputs.forEach((o) => lines.push(`- ${o}`));
        lines.push("");
      }

      if (Array.isArray(customers) && customers.length) {
        lines.push("**Customers**");
        customers.forEach((c) => lines.push(`- ${c}`));
        lines.push("");
      }
    }

    // Events / business events / key events
    if (Array.isArray(record.events) && record.events.length) {
      lines.push("## Events");
      lines.push("");
      record.events.forEach((e, idx) => {
        lines.push(`- **${idx + 1}. ${e.name ?? e.type ?? "Event"}**`);
        if (e.type) lines.push(`  - Type: \`${e.type}\``);
        if (e.note) lines.push(`  - Note: ${e.note}`);
      });
      lines.push("");
    }

    if (Array.isArray(record.business_events) && record.business_events.length) {
      lines.push("## Business events");
      lines.push("");
      record.business_events.forEach((e, idx) => {
        lines.push(`- **${idx + 1}. ${e.name}**`);
        if (e.description) lines.push(`  - ${e.description}`);
        if (e.lane) lines.push(`  - Lane: ${e.lane}`);
      });
      lines.push("");
    }

    if (Array.isArray(record.key_events) && record.key_events.length) {
      lines.push("## Key events");
      lines.push("");
      record.key_events.forEach((e, idx) => {
        lines.push(`- **${idx + 1}. ${e.name}**`);
        if (e.description) lines.push(`  - ${e.description}`);
      });
      lines.push("");
    }

    // Touchpoints
    if (Array.isArray(record.touchpoints) && record.touchpoints.length) {
      lines.push("## Touchpoints");
      lines.push("");
      record.touchpoints.forEach((t, idx) => {
        const lane = t.lane ? ` (${t.lane})` : "";
        const emo = t.emotion ? ` ${t.emotion}` : "";
        lines.push(`- **${idx + 1}. ${t.channel}${lane}${emo}** – ${t.step}`);
      });
      lines.push("");
    }

    // Systems
    if (Array.isArray(record.systems_involved) && record.systems_involved.length) {
      lines.push("## Systems involved");
      lines.push("");
      record.systems_involved.forEach((s) => {
        lines.push(`- **${s.name}** – ${s.responsibility}`);
      });
      lines.push("");
    }

    // Risks
    if (Array.isArray(record.risks) && record.risks.length) {
      lines.push("## Risks");
      lines.push("");
      record.risks.forEach((r, idx) => {
        lines.push(`- **Risk ${idx + 1}**`);
        if (r.description) lines.push(`  - Description: ${r.description}`);
        if (r.likelihood) lines.push(`  - Likelihood: ${r.likelihood}`);
        if (r.impact) lines.push(`  - Impact: ${r.impact}`);
        if (r.mitigation) lines.push(`  - Mitigation: ${r.mitigation}`);
      });
      lines.push("");
    }

    // Metrics (object → list of key/value)
    if (record.metrics && typeof record.metrics === "object") {
      lines.push("## Metrics");
      lines.push("");
      Object.entries(record.metrics).forEach(([key, value]) => {
        lines.push(`- **${key}:** ${value}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  try {
    // ----------------------------------------------------
    // 1) Try to load the progress overlay
    // ----------------------------------------------------
    try {
      const progressUrl = app.vault.adapter.getResourcePath(
        "var/scripts/utilities/import-progress-modal.js"
      );
      const { createProgressOverlay } = await import(progressUrl);

      progress = createProgressOverlay(`Faker Import – ${datasetType}`);

      progress.setSteps(1);
      progress.setStepIndex(1, "Generating faker records");

      progress.setTotals({ itemsTotal: count });

      progress.setStatus(
        `Starting faker import for "${datasetType}" into "${modelFolder}" ...`
      );
      progress.log(
        `Starting faker import: ${count} "${datasetType}" records -> "${modelFolder}".`,
        "info"
      );
    } catch (overlayErr) {
      console.warn("Could not load import-progress-modal.js:", overlayErr);
      // continue without overlay
    }

    // ----------------------------------------------------
    // 2) Main loop – create files
    // ----------------------------------------------------
    for (let i = 1; i <= count; i++) {
      if (progress?.isCancelled && progress.isCancelled()) {
        progress.setStatus(
          `Import cancelled after ${created} of ${count} records.`
        );
        progress.log(
          `Import cancelled by user – created ${created} of ${count} records.`,
          "warning"
        );
        break;
      }

      const record = generator();

      // Ensure we have an id
      if (!record.id) {
        record.id = faker.string.uuid();
      }

      const indexStr = String(i).padStart(4, "0");
      const baseName = `${datasetType}-${indexStr}`;
      let fileName = `${baseName}.md`;
      let filePath = `${modelFolder}/${fileName}`;

      // Avoid name collisions
      let suffix = 1;
      while (await app.vault.adapter.exists(filePath)) {
        fileName = `${baseName}-${suffix}.md`;
        filePath = `${modelFolder}/${fileName}`;
        suffix++;
      }

      const createdAt = new Date().toISOString();

      const frontmatterObj = {
        dataset_type: datasetType,
        faker: true,
        created: createdAt,
        id: record.id,
      };

      const frontmatterLines = Object.entries(frontmatterObj)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

      const jsonNoteContent =
        `---\n${frontmatterLines}\n---\n\n` +
        `# ${datasetType} ${indexStr}\n\n` +
        "```json\n" +
        JSON.stringify(record, null, 2) +
        "\n```\n";

      // Base JSON note
      await app.vault.adapter.write(filePath, jsonNoteContent);
      created++;

      // ------------------------------------------------
      // 2b) Scenario folder structure & domain markdown
      // ------------------------------------------------
      if (withFolderStructure && isScenarioDataset(datasetType)) {
        // derive domain
        const domainName =
          record.domain ||
          record.product?.name ||
          record.lifecycle_stage ||
          record.scenario_type ||
          "general";

        const domainSlug = slugify(domainName);
        const domainFolderPath = `${modelFolder}/${domainSlug}`;

        await ensureFolderExists(domainFolderPath);

        const scenarioTitle = record.name || `${datasetType} ${indexStr}`;
        const scenarioSlug = slugify(scenarioTitle);
        const scenarioFileName = `${indexStr} - ${scenarioSlug}.md`;
        const scenarioFilePath = `${domainFolderPath}/${scenarioFileName}`;

        const scenarioFrontmatter = {
          dataset_type: datasetType,
          faker: true,
          created: createdAt,
          id: record.id,
          scenario_type: record.scenario_type ?? null,
          domain: record.domain ?? null,
          name: record.name ?? null,
        };

        const scenarioFmLines = Object.entries(scenarioFrontmatter)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");

        const scenarioBody = buildScenarioMarkdown(record, indexStr);
        const scenarioContent = `---\n${scenarioFmLines}\n---\n\n${scenarioBody}\n`;

        await app.vault.adapter.write(scenarioFilePath, scenarioContent);

        if (progress) {
          progress.log(
            `Created scenario markdown for domain "${domainName}": ${scenarioFileName}`,
            "info"
          );
        }
      }

      // ------------------------------------------------
      // 3) Update overlay
      // ------------------------------------------------
      if (progress) {
        progress.setProcessedItems(created);
        progress.setStatus(
          `Generating ${datasetType} records (${created}/${count}) ...`
        );

        if (i === 1 || i === count || i % 25 === 0) {
          progress.log(
            `Created record ${i}/${count}: ${fileName}`,
            "info"
          );
        }
      }
    }

    // ----------------------------------------------------
    // 4) Finish
    // ----------------------------------------------------
    if (progress && !progress.isCancelled()) {
      progress.setProcessedItems(created);
      progress.setStatus(
        `Faker import completed – created ${created} of ${count} records.`
      );
      progress.log(
        `Faker import finished successfully – ${created} records created.`,
        "success"
      );
    }

    return created;
  } catch (err) {
    console.error("Error during faker import:", err);

    if (progress) {
      progress.setStatus("Error during faker import.");
      progress.log(
        `Error during faker import: ${err?.message ?? String(err)}`,
        "error"
      );
    }

    throw err;
  } finally {
    if (progress) {
      progress.close();
    }
  }
}
