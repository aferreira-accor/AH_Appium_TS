#!/usr/bin/env ts-node

import "dotenv/config";
import axios from "axios";

async function deleteExcludedBuilds() {
  const username = process.env.BROWSERSTACK_USERNAME;
  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;

  const client = axios.create({
    baseURL: "https://api-cloud.browserstack.com",
    auth: {
      username: username!,
      password: accessKey!,
    },
  });

  const buildsToDelete = [
    {
      name: "Wildcard build",
      app_id: "7f4fb57af0dbea72d0b13f9721cdae4182cc3d1c",
      custom_id: "wildcardbot_prod_googleProdRelease_10.72.1.25101705",
    },
    {
      name: "Huawei build 1",
      app_id: "c0e140b869a7d9af4ecb77747d380f85ae4a0f98",
      custom_id: "PipelineHuaweiProdRelease_HuaweiProdRelease_10.71.3.25102001",
    },
    {
      name: "Huawei build 2",
      app_id: "bf29c1032b0eeeb97147ecdb7546c725b8d3a3e9",
      custom_id: "PipelineHuaweiProdRelease_HuaweiProdRelease_10.71.2.25101601",
    },
  ];

  console.log("🗑️  Deleting excluded builds from BrowserStack...\n");

  let successCount = 0;
  let errorCount = 0;

  for (const build of buildsToDelete) {
    try {
      console.log(`Deleting: ${build.name}`);
      console.log(`  App ID: ${build.app_id}`);
      console.log(`  Custom ID: ${build.custom_id}`);

      const response = await client.delete(
        `/app-automate/app/delete/${build.app_id}`
      );

      console.log(`  ✅ Success:`, response.data);
      successCount++;
      console.log("");
    } catch (error: any) {
      console.log(
        `  ❌ Error:`,
        error.response?.data || error.message
      );
      errorCount++;
      console.log("");
    }
  }

  console.log("📊 Summary:");
  console.log(`  ✅ Successfully deleted: ${successCount} builds`);
  console.log(`  ❌ Failed to delete: ${errorCount} builds`);
  console.log(`  📱 Total: ${buildsToDelete.length} builds`);
}

deleteExcludedBuilds();
