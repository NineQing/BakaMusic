const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const packageJson = require(path.join(projectRoot, "package.json"));
const {
    githubAcceleratorPrefixes,
} = require(path.join(projectRoot, "src/common/constant.ts"));
const {
    createNsisWebPackageUrl,
} = require(path.join(projectRoot, "config/forge-nsis-maker.ts"));
const forgeConfig = require(path.join(projectRoot, "forge.config.ts")).default;
const workflowSource = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/build.yml"),
    "utf8",
);

async function testInstallerCleanup() {
    if (process.platform !== "win32") {
        console.log("windows-packaging: native NSIS cleanup test requires Windows");
        return;
    }
    const { getMakeNsisPath } = require("app-builder-lib/out/toolsets/windows");
    const compiler = await getMakeNsisPath();
    const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bakamusic-nsis-cleanup-"));
    const installer = path.join(testRoot, "cleanup.exe");
    function execute(file, args, env = process.env) {
        const result = spawnSync(file, args, {
            env,
            encoding: "utf8",
            windowsHide: true,
            timeout: 30_000,
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, `${file}: ${result.stdout}\n${result.stderr}`);
    }
    try {
        execute(compiler.path, [
            "/V2",
            `/DOUTPUT_FILE=${installer}`,
            `/DINSTALLER_INCLUDE=${path.join(projectRoot, "release/installer.nsh")}`,
            path.join(__dirname, "fixtures/windows-installer-cleanup.nsi"),
        ], { ...process.env, ...compiler.env });
        let shortNameCovered = false;
        for (const scenario of ["fresh", "inno-migration", "repair"]) {
            const installDir = path.join(testRoot, `${scenario} BakaMusic`);
            fs.mkdirSync(installDir);
            const legacyFiles = scenario === "inno-migration"
                ? ["000", "001", "009", "010", "099", "100", "999"].flatMap(
                    (suffix) => ["exe", "dat", "msg"].map((ext) => `unins${suffix}.${ext}`),
                ) : [];
            const retainedFiles = [
                "BakaMusic.exe", "uninsABC.exe", "unins000.exe.bak", "unins1000.exe",
                "uninstall-notes.dat", "uninstall-notes.msg", "preferences.json",
            ];
            for (const name of [...legacyFiles, ...retainedFiles]) {
                fs.writeFileSync(path.join(installDir, name), name);
            }
            const uninstaller = path.join(installDir, "Uninstall BakaMusic.exe");
            const installerEnv = { ...process.env, BAKAMUSIC_NSIS_TEST_DIR: installDir };
            if (scenario === "repair") {
                execute(installer, ["/S"], installerEnv);
                // Model a previous install with the uninstaller missing.
                fs.unlinkSync(uninstaller);
            }
            execute(installer, ["/S"], installerEnv);
            assert.ok(fs.existsSync(uninstaller), `${scenario}: uninstaller must survive cleanup`);
            for (const name of legacyFiles) {
                assert.equal(fs.existsSync(path.join(installDir, name)), false, name);
            }
            for (const name of retainedFiles) {
                assert.equal(fs.readFileSync(path.join(installDir, name), "utf8"), name);
            }
            shortNameCovered ||= fs.existsSync(path.join(installDir, "short-name-match.txt"));
            // _?= must be unquoted and last; NSIS consumes the rest of the command
            // line. Run in place so the process is waited for instead of a temp copy.
            const result = spawnSync(uninstaller, ["/S", `_?=${installDir}`], {
                windowsHide: true,
                windowsVerbatimArguments: true,
                timeout: 30_000,
            });
            assert.ifError(result.error);
            assert.equal(result.status, 0, `${scenario}: uninstaller must run successfully`);
            assert.ok(fs.existsSync(path.join(installDir, "uninstaller-ran.txt")), scenario);
        }
        console.log(`windows-packaging: NSIS cleanup passed (8.3 collision ${shortNameCovered ? "covered" : "unavailable on test volume"})`);
    } finally {
        const relative = path.relative(os.tmpdir(), testRoot);
        assert.ok(relative.startsWith("bakamusic-nsis-cleanup-") && !relative.includes(path.sep));
        fs.rmSync(testRoot, { recursive: true, force: true });
    }
}

async function run() {
    const nsisMaker = forgeConfig.makers.find((maker) => maker.name === "nsis");
    assert.ok(nsisMaker, "Forge must configure an NSIS maker");
    assert.deepEqual(nsisMaker.platforms, ["win32"]);

    await nsisMaker.prepareConfig("x64");
    assert.equal(nsisMaker.config.appId, "com.zencok.bakamusic");
    assert.equal(nsisMaker.config.compression, "maximum");
    assert.deepEqual(nsisMaker.config.targets, ["nsis", "nsis-web"]);
    assert.equal(
        nsisMaker.config.webPackageBaseUrl,
        "https://github.com/Zencok/BakaMusic/releases/download",
    );
    assert.equal(
        nsisMaker.config.webPackageUrlPrefix,
        githubAcceleratorPrefixes[0],
    );
    assert.equal(nsisMaker.config.nsis.oneClick, false);
    assert.equal(nsisMaker.config.nsis.perMachine, false);
    assert.equal(nsisMaker.config.nsis.selectPerMachineByDefault, true);
    assert.equal(nsisMaker.config.nsis.allowToChangeInstallationDirectory, true);
    assert.equal(
        nsisMaker.config.nsis.include,
        path.join(projectRoot, "release/installer.nsh"),
    );
    assert.equal(
        nsisMaker.config.nsis.artifactName,
        "BakaMusic-${version}-win32-${arch}-setup.${ext}",
    );
    assert.deepEqual(
        nsisMaker.config.nsis.installerLanguages,
        ["en_US", "zh_CN"],
    );
    assert.equal(
        nsisMaker.config.nsisWeb.artifactName,
        "BakaMusic-${version}-win32-${arch}-web-setup.${ext}",
    );
    assert.equal(
        createNsisWebPackageUrl(
            nsisMaker.config.webPackageBaseUrl,
            nsisMaker.config.webPackageName,
            packageJson.version,
            "x64",
            githubAcceleratorPrefixes[0],
        ),
        `${githubAcceleratorPrefixes[0]}`
        + "https://github.com/Zencok/BakaMusic/releases/download/"
        + `v${packageJson.version}/bakamusic-${packageJson.version}-x64.nsis.7z`,
    );
    assert.equal(
        createNsisWebPackageUrl(
            nsisMaker.config.webPackageBaseUrl,
            nsisMaker.config.webPackageName,
            packageJson.version,
            "x64",
            "",
        ),
        "https://github.com/Zencok/BakaMusic/releases/download/"
        + `v${packageJson.version}/bakamusic-${packageJson.version}-x64.nsis.7z`,
    );

    assert.equal(packageJson.devDependencies["app-builder-lib"], "26.15.3");
    assert.equal(
        packageJson.devDependencies["@electron-forge/maker-base"],
        "7.11.2",
    );
    const nsisMakerSource = fs.readFileSync(
        path.join(projectRoot, "config/forge-nsis-maker.ts"),
        "utf8",
    );
    assert.match(
        nsisMakerSource,
        /publish:\s*"never"/,
        "NSIS maker must disable electron-builder implicit tag publish",
    );
    assert.match(workflowSource, /npm run make -- .*--skip-package/);
    assert.match(workflowSource, /\.nsis\.7z/);
    assert.match(workflowSource, /-web-setup\.exe/);
    assert.doesNotMatch(workflowSource, /\biscc\b|innosetup/i);
    assert.equal(
        fs.existsSync(path.join(projectRoot, "release/build-windows.iss")),
        false,
    );
    const nsisIncludeSource = fs.readFileSync(
        path.join(projectRoot, "release/installer.nsh"),
        "utf8",
    );
    assert.match(nsisIncludeSource, /\{BakaMusic\}_is1/);
    assert.match(nsisIncludeSource, /!macro customInstallMode/);
    assert.match(nsisIncludeSource, /!macro customInstall/);
    assert.match(nsisIncludeSource, /!insertmacro removeLegacyInnoUninstallers/);
    assert.doesNotMatch(nsisIncludeSource, /^\s*Delete\s+[^\r\n]*[?*]/m);

    await testInstallerCleanup();

    console.log("windows-packaging: all assertions passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
