/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack: (config, { dev, isServer }) => {
        if (dev && !isServer) {
            // Disable HMR
            config.plugins = config.plugins.filter((plugin) => plugin.constructor.name !== 'HotModuleReplacementPlugin');
        }
        return config;
    },
};

export default nextConfig;
