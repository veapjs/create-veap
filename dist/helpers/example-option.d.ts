type RepoInfo = {
    username: string | undefined;
    name: string | undefined;
    branch: string | undefined;
    filePath: string | undefined;
};
type ParsedExampleOption = {
    example: string;
    repoInfo: RepoInfo;
};
export declare function parseExampleOption(example: string | undefined): Promise<ParsedExampleOption | null>;
export declare function downloadAndExtract(root: string, { example, repoInfo }: ParsedExampleOption): Promise<void>;
export {};
