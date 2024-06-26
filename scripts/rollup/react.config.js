// packages/react 的打包配置
import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from "./utils.ts";
import generatePackageJson from 'rollup-plugin-generate-package-json';

const { name, module } = getPackageJSON('react');
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);

export default [
    // react
    {
        input: `${pkgPath}/${module}`,
        output: {
            file: `${pkgDistPath}/index.js`,
            name: 'React',
            format: 'umd'
        },
        plugins: [...getBaseRollupPlugins(), generatePackageJson({
            inputFolder: pkgPath,
            outputFolder: pkgDistPath,
            baseContents: ({ name, description, version }) => ({
                name,
                description,
                version,
                main: 'index.js'
            })
        })]
    },
    // runtime
    {
        input: `${pkgPath}/src/jsx.ts`,
        output: [
            // jsx-dev-runtime
            {
                file: `${pkgDistPath}/jsx-dev-runtime.js`,
                name: 'jsx-dev-runtime',
                formate: 'umd'
            },
            // dev-runtime
            {
                file: `${pkgDistPath}/dev-runtime.js`,
                name: 'dev-runtime',
                formate: 'umd'
            }
        ],
        plugins: getBaseRollupPlugins()
    }
];
