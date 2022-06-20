import {
  AnnotationIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  DocumentTextIcon,
  ExclamationIcon,
  FireIcon,
  InformationCircleIcon,
  LightningBoltIcon,
  PencilIcon,
  PuzzleIcon,
  QuestionMarkCircleIcon,
  XIcon,
} from "@heroicons/react/outline";
import cytoscape from "cytoscape";
import dirTree from "directory-tree";
import fs from "fs";
import matter from "gray-matter";
import Markdown from "marked-react";
import { GetStaticPaths, GetStaticProps } from "next";
import { NextSeo } from "next-seo";
import dynamic from "next/dynamic";
import Link from "next/link";
import path from "path";
import { ReactElement, useEffect, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { nord } from "react-syntax-highlighter/dist/cjs/styles/hljs";
import useSWR from "swr";
import { environment } from "../utils/environment";
import { classNames } from "../utils/misc";
import { Post, PostMetadata } from "../utils/types";

const MarkdownIt = require("markdown-it"),
  md = new MarkdownIt();

const Graph = dynamic(() => import("../components/Graph"), {
  ssr: false,
});

const FilePage = (props: { post: Post }) => {
  const [graphPosts, setGraphPosts] = useState<Post[]>([]);
  const [currentPost, setCurrentPost] = useState<Post>();
  const [graphElements, setGraphElements] = useState<
    cytoscape.ElementDefinition[]
  >([]);
  const [showInlineLinkPopover, setShowInlineLinkPopover] =
    useState<string>("");
  const links: string[] = [];

  // Render links
  const renderer = {
    link(href: string, text: string) {
      if (href.endsWith(".md")) {
        let linkedPostContent = "";
        let mdPath = href;

        if (typeof window !== "undefined" && graphPosts.length > 0) {
          // Client-side-only code
          mdPath = new URL(href, window.location.href).href
            .replace(window.location.origin + "/", "")
            .replace(".md", "");
          const linkedPost = graphPosts.filter((p) => p.url === mdPath);
          if (linkedPost.length > 0) {
            linkedPostContent = linkedPost[0].content;
          }

          let highestKey = 0;
          for (const link of links) {
            const splitLink = link.split("?key=");
            const originalLink = splitLink[0];
            const key = splitLink[1];
            if (originalLink === mdPath) {
              highestKey = parseInt(key) + 1;
            }
          }

          mdPath += `?key=${highestKey}`;
          links.push(mdPath);
        }

        return (
          <span key={href}>
            <Link href={mdPath}>
              <a
                onMouseOver={() => setShowInlineLinkPopover(mdPath)}
                onMouseOut={() => setShowInlineLinkPopover("")}
                className="px-0.5 mx-0.5 mr-1 rounded-sm bg-indigo-200 hover:bg-indigo-300 text-gray-800 hover:text-gray-600 opacity-70 no-underline"
              >
                {text[0]}
              </a>
            </Link>
            <span
              className={classNames(
                "whitespace-normal prose sm:prose-md dark:prose-invert dark:text-gray-300 linkPopup scrollbar-thin dark:scrollbar-thumb-neutral-900 dark:scrollbar-track-neutral-800 scrollbar-thumb-gray-400 scrollbar-track-gray-50",
                showInlineLinkPopover === mdPath && linkedPostContent
                  ? ""
                  : "hidden"
              )}
              dangerouslySetInnerHTML={{
                __html: md.render(linkedPostContent),
              }}
            ></span>
          </span>
        );
      } else {
        return (
          <Link key={href} href={href}>
            <a className="text-indigo-400 hover:text-indigo-500 no-underline">
              {text[0]}
            </a>
          </Link>
        );
      }
    },
    table(children: any) {
      return (
        <div className="not-prose relative shadow-md rounded-sm sm:rounded-lg overflow-x-scroll max-w-full scrollbar-thin dark:scrollbar-thumb-neutral-900 dark:scrollbar-track-neutral-800 scrollbar-thumb-gray-400 scrollbar-track-gray-50">
          <table className="table">
            {children[0]}
            {children[1]}
          </table>
        </div>
      ) as ReactElement;
    },
    paragraph(text: string) {
      return (
        <div
          style={{
            display: "block",
            marginTop: "1em",
            marginBottom: "1em",
            marginLeft: 0,
            marginRight: 0,
          }}
        >
          {text}
        </div>
      );
    },
    html(html: string) {
      return <div dangerouslySetInnerHTML={{ __html: html }}></div>;
    },
    blockquote(quoteBlocks: ReactElement[]) {
      if (quoteBlocks && quoteBlocks.length > 0) {
        try {
          let quote;
          for (const block of quoteBlocks) {
            if (block) {
              quote = block;
            }
          }
          let quoteText: string = "";
          for (const span of quote?.props.children) {
            quoteText += span.props.dangerouslySetInnerHTML.__html;
          }

          if (quoteText) {
            const re = /\[!([^\s#]+)\]/g;
            const match = re.exec(quoteText);
            const filteredQuoteText = quoteText.replace(re, "").trimStart();

            if (match && match.length > 0) {
              const callout = match[1];
              switch (callout.toLowerCase()) {
                case "note":
                  return (
                    <div
                      role="alert"
                      className="my-3 border-l-4 shadow-sm border-blue-500 rounded-md"
                    >
                      <div className="flex flex-row items-center bg-blue-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <PencilIcon className="h-5 w-5 text-blue-500" />
                        <span className="ml-1">Note</span>
                      </div>
                      <div className="bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white rounded-b">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "abstract":
                case "summary":
                case "tldr":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-sky-500"
                    >
                      <div className="flex flex-row items-center bg-sky-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <ClipboardListIcon className="h-5 w-5 text-sky-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white rounded-b">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "info":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-cyan-500"
                    >
                      <div className="flex flex-row items-center bg-cyan-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <InformationCircleIcon className="h-5 w-5 text-cyan-500" />
                        <span className="ml-1">Info</span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "tip":
                case "hint":
                case "important":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-teal-500"
                    >
                      <div className="flex flex-row items-center bg-teal-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <FireIcon className="h-5 w-5 text-teal-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "success":
                case "check":
                case "done":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-green-500"
                    >
                      <div className="flex flex-row items-center bg-green-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "question":
                case "help":
                case "faq":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-emerald-500"
                    >
                      <div className="flex flex-row items-center bg-emerald-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <QuestionMarkCircleIcon className="h-5 w-5 text-emerald-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "warning":
                case "caution":
                case "attention":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-orange-500"
                    >
                      <div className="flex flex-row items-center bg-orange-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <ExclamationIcon className="h-5 w-5 text-orange-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "failure":
                case "fail":
                case "missing":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-rose-500"
                    >
                      <div className="flex flex-row items-center bg-rose-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <XIcon className="h-5 w-5 text-rose-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "danger":
                case "error":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-red-500"
                    >
                      <div className="flex flex-row items-center bg-red-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <LightningBoltIcon className="h-5 w-5 text-red-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "bug":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-pink-500"
                    >
                      <div className="flex flex-row items-center bg-pink-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <PuzzleIcon className="h-5 w-5 text-pink-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "example":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-purple-500"
                    >
                      <div className="flex flex-row items-center bg-purple-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <DocumentTextIcon className="h-5 w-5 text-purple-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                case "quote":
                  return (
                    <div
                      role="alert"
                      className="my-3 rounded-md border-l-4 shadow-sm border-gray-500"
                    >
                      <div className="flex flex-row items-center bg-gray-500/30 dark:text-white text-black text-sm font-bold px-4 py-3 rounded-t">
                        <AnnotationIcon className="h-5 w-5 text-gray-500" />
                        <span className="ml-1">
                          {callout[0].toUpperCase() +
                            callout.substring(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="rounded-b bg-white dark:bg-neutral-800 px-4 py-3 text-black dark:text-white">
                        <p className="whitespace-pre-wrap">
                          {filteredQuoteText}
                        </p>
                      </div>
                    </div>
                  ) as ReactElement;
                default:
                  break;
              }
            }
          }
        } catch (error) {}

        return (
          <div className="my-3 border-l-4 px-4 py-0.5 border-gray-500 dark:bg-neutral-800 bg-white prose whitespace-pre-wrap dark:prose-invert">
            {quoteBlocks}
          </div>
        ) as ReactElement;
      } else {
        return (
          <div className="border-l-4 px-4 my-3 py-0.5 border-gray-500 dark:bg-neutral-800 bg-white prose whitespace-pre-wrap dark:prose-invert">
            {quoteBlocks}
          </div>
        ) as ReactElement;
      }
    },
    text(text: string) {
      const formattedText = text.replace(
        /==([^=]+)==/g,
        `<span class="highlight">$1</span>`
      );
      return (
        <span
          key={text.substring(0, 20)}
          dangerouslySetInnerHTML={{ __html: formattedText }}
        />
      );
    },
    code(code: any, language: any) {
      return (
        <SyntaxHighlighter language={language} style={nord}>
          {code}
        </SyntaxHighlighter>
      );
    },
  };

  const [postContent, setPostContent] = useState<string>(props.post.content);

  const [showBacklinkPopover, setShowBacklinkPopover] = useState<string>("");

  const getGraphElements = (currentPost: Post) => {
    const elements = [] as cytoscape.ElementDefinition[];

    elements.push({
      data: {
        id: currentPost.url,
        label: currentPost.title,
      },
      selected: true,
    });

    for (const backlinkedPostUrl of currentPost.backlinks) {
      // Get backlinked post from graph posts
      const backlinkedPosts = graphPosts.filter((p) => {
        return p.url === backlinkedPostUrl;
      });

      if (backlinkedPosts.length > 0) {
        elements.push({
          data: {
            id: backlinkedPosts[0].url,
            label: decodeURIComponent(
              backlinkedPosts[0].url.split("/").pop() ?? ""
            ),
          },
        });
        elements.push({
          data: {
            source: backlinkedPosts[0].url,
            target: currentPost.url,
          },
        });

        for (const l2link of backlinkedPosts[0].links) {
          elements.push({
            data: {
              id: l2link,
              label: decodeURIComponent(l2link.split("/").pop() ?? ""),
            },
          });
          elements.push({
            data: { source: l2link, target: backlinkedPosts[0].url },
          });
        }

        for (const l2backlink of backlinkedPosts[0].backlinks) {
          elements.push({
            data: {
              id: l2backlink,
              label: decodeURIComponent(l2backlink.split("/").pop() ?? ""),
            },
          });
          elements.push({
            data: { source: l2backlink, target: backlinkedPosts[0].url },
          });
        }
      }
    }

    for (const linkedPostUrl of currentPost.links) {
      // Get linked post from graph posts
      const linkedPosts = graphPosts.filter((p) => {
        return p.url === linkedPostUrl;
      });

      if (linkedPosts.length > 0) {
        elements.push({
          data: {
            id: linkedPosts[0].url,
            label: decodeURIComponent(
              linkedPosts[0].url.split("/").pop() ?? ""
            ),
          },
        });
        elements.push({
          data: { source: linkedPosts[0].url, target: currentPost.url },
        });

        for (const l2link of linkedPosts[0].links) {
          elements.push({
            data: {
              id: l2link,
              label: decodeURIComponent(l2link.split("/").pop() ?? ""),
            },
          });
          elements.push({
            data: { source: l2link, target: linkedPosts[0].url },
          });
        }

        for (const l2backlink of linkedPosts[0].backlinks) {
          elements.push({
            data: {
              id: l2backlink,
              label: decodeURIComponent(l2backlink.split("/").pop() ?? ""),
            },
          });
          elements.push({
            data: { source: l2backlink, target: linkedPosts[0].url },
          });
        }
      }
    }

    setGraphElements(elements);
  };

  const fetcher = (endpoint: string) =>
    fetch(endpoint).then((res) => res.json());

  const { data, isValidating, mutate, error } = useSWR(
    "/api/content-graph",
    fetcher
  );

  useEffect(() => {
    setPostContent(props.post.content);
    if (
      !sessionStorage.getItem("graph") ||
      sessionStorage.getItem("graph") === "[]"
    ) {
      mutate();
    } else {
      const graphData = JSON.parse(sessionStorage.getItem("graph") ?? "[]");
      setGraphPosts(graphData);

      // Get current post from graph posts
      const currentPosts = graphData.filter((p: Post) => {
        return p.url === props.post.url;
      });

      if (currentPosts.length > 0) {
        setCurrentPost(currentPosts[0]);
      }
    }
  }, [props]);

  useEffect(() => {
    if (data && !error) {
      sessionStorage.setItem("graph", JSON.stringify(data.graph));
      setGraphPosts(data.graph);

      // Get current post from graph posts
      const currentPosts = data.graph.filter((p: Post) => {
        return p.url === props.post.url;
      });

      if (currentPosts.length > 0) {
        setCurrentPost(currentPosts[0]);
      }
    }
  }, [data]);

  useEffect(() => {
    if (currentPost) {
      getGraphElements(currentPost);
    } else {
      setGraphElements([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPost]);

  useEffect(() => {
    setGraphPosts(JSON.parse(sessionStorage.getItem("graph") ?? "[]"));
  }, []);

  return (
    <div>
      <NextSeo
        title={
          (props.post.metadata?.title ?? props.post.title) +
          " - " +
          environment.NEXT_PUBLIC_PROJECT_NAME
        }
        description={
          props.post.metadata?.description ??
          props.post.content.substring(0, 280)
        }
        canonical={props.post.metadata?.canonical}
        openGraph={{
          url: props.post.metadata?.ogUrl,
          title: props.post.metadata?.ogTitle,
          description: props.post.metadata?.ogDescription,
          images: [{ url: props.post.metadata?.ogImage ?? "" }],
          site_name: props.post.metadata?.ogSitename,
        }}
        twitter={{
          handle: props.post.metadata?.twitterHandle,
          site: props.post.metadata?.twitterSite,
          cardType: props.post.metadata?.twitterCardType,
        }}
      />
      <div className="prose sm:prose-md dark:prose-invert dark:text-gray-300 whitespace-pre-wrap">
        {postContent === "" && (
          <div>
            <h1>{props.post.title}</h1>
          </div>
        )}
        <div>
          <Markdown value={postContent} renderer={renderer} />
        </div>
      </div>
      <div className="w-full">
        {!isValidating &&
          (graphElements.length > 1 ||
            (currentPost && currentPost.backlinks.length > 0)) && (
            <div>
              <hr className="my-12 w-1/3 border dark:border-neutral-600 border-neutral-200" />
              <div>
                {currentPost && currentPost.backlinks.length > 0 && (
                  <>
                    <h3 className="text-xl font-bold mb-4 dark:text-white text-black">
                      Backlinks
                    </h3>
                    <div>
                      {currentPost.backlinks.map((link, i) => {
                        let linkedPostContent = "";
                        if (
                          typeof window !== "undefined" &&
                          graphPosts.length > 0
                        ) {
                          // Client-side-only code
                          const linkedPost = graphPosts.filter(
                            (p) => p.url === link
                          );
                          if (linkedPost.length > 0) {
                            linkedPostContent = linkedPost[0].content;
                          }
                        }

                        return (
                          <div key={i}>
                            <Link href={link}>
                              <a
                                onMouseOver={() => setShowBacklinkPopover(link)}
                                onMouseOut={() => setShowBacklinkPopover("")}
                                className="px-1 my-1 rounded-sm bg-indigo-200 hover:bg-indigo-300 text-gray-800 hover:text-gray-600 opacity-70"
                              >
                                {link.split("/").length > 0
                                  ? decodeURIComponent(
                                      link.split("/").pop() ?? ""
                                    )
                                  : "..."}
                              </a>
                            </Link>
                            <span
                              className={classNames(
                                "prose sm:prose-md dark:prose-invert dark:text-gray-300 linkPopup scrollbar-thin dark:scrollbar-thumb-neutral-900 dark:scrollbar-track-neutral-800 scrollbar-thumb-gray-400 scrollbar-track-gray-50",
                                showBacklinkPopover === link &&
                                  linkedPostContent
                                  ? ""
                                  : "hidden"
                              )}
                              dangerouslySetInnerHTML={{
                                __html: md.render(linkedPostContent),
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {graphElements.length > 1 && (
                  <>
                    <h3 className="text-xl font-bold my-4 dark:text-white text-black">
                      Graph
                    </h3>
                    <div className="border-2 rounded-md dark:border-neutral-600 border-neutral-200 w-full h-64 mt-4">
                      <Graph elements={graphElements} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  let filePaths = getNavigationPaths();

  filePaths = filePaths?.map((filePath) => {
    return {
      params: {
        filePath: filePath.params.filePath[0].split("/"),
      },
    };
  });

  return {
    paths: filePaths ?? [],
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  if (context.params?.filePath) {
    return {
      props: {
        post: getPost((context.params?.filePath as string[]).join("/")),
      },
    };
  } else {
    return {
      props: {
        post: null,
      },
    };
  }
};

export default FilePage;

// Internal functions
const getPost = (postPath: string) => {
  const resolvedPath = "content/" + postPath + ".md";

  try {
    const mdFile = fs.readFileSync(path.resolve(resolvedPath), "utf-8");

    try {
      const md = matter(mdFile, {});

      const metadata = {
        title: md.data.hasOwnProperty("title")
          ? md.data.title
          : postPath.split("/")[postPath.split("/").length - 1],
        description: md.data.hasOwnProperty("description")
          ? md.data.description
          : md.content.substring(0, 280),
      } as PostMetadata;

      if (md.data.hasOwnProperty("canonical")) {
        metadata.canonical = md.data.canonical;
      }

      if (md.data.hasOwnProperty("ogUrl")) {
        metadata.ogUrl = md.data.ogUrl;
      }

      if (md.data.hasOwnProperty("ogTitle")) {
        metadata.ogTitle = md.data.ogTitle;
      }

      if (md.data.hasOwnProperty("ogDescription")) {
        metadata.ogDescription = md.data.ogDescription;
      }

      if (md.data.hasOwnProperty("ogImage")) {
        metadata.ogImage = md.data.ogImage;
      }

      if (md.data.hasOwnProperty("ogSitename")) {
        metadata.ogSitename = md.data.ogSitename;
      }

      if (md.data.hasOwnProperty("twitterHandle")) {
        metadata.twitterHandle = md.data.twitterHandle;
      }

      if (md.data.hasOwnProperty("twitterSite")) {
        metadata.twitterSite = md.data.twitterSite;
      }

      if (md.data.hasOwnProperty("twitterCardType")) {
        metadata.twitterCardType = md.data.twitterCardType;
      }

      return {
        url: postPath,
        title: postPath.split("/")[postPath.split("/").length - 1],
        content: md.content,
        links: [],
        backlinks: [],
        metadata: metadata,
      } as Post;
    } catch (error) {
      console.error("Error occurred in getPost - ", error);
      return {
        url: postPath,
        title: postPath.split("/")[postPath.split("/").length - 1],
        content: mdFile,
        links: [],
        backlinks: [],
        metadata: {
          title: postPath.split("/")[postPath.split("/").length - 1],
          description: mdFile.substring(0, 280),
        },
      } as Post;
    }
  } catch (error) {
    return null;
  }
};

const getNavigationPaths = () => {
  const directoryTree = dirTree("content", { extensions: /\.md/ });

  return directoryTree.children?.flatMap((item) => {
    if (item.hasOwnProperty("children")) {
      // Iterate on it with child function
      return getNavigationChildrenPaths(item, "", 0);
    } else {
      return {
        params: {
          filePath: [item.name.replace(".md", "")],
        },
      };
    }
  });
};

const getNavigationChildrenPaths = (
  item: dirTree.DirectoryTree,
  filePath: string,
  depth: number
):
  | {
      params: {
        filePath: string[];
      };
    }
  | {
      params: {
        filePath: string[];
      };
    }[] => {
  if (item.children) {
    return item.children.flatMap((child) => {
      return getNavigationChildrenPaths(
        child,
        filePath
          ? filePath + "/" + item.name.replace(".md", "")
          : item.name.replace(".md", ""),
        depth + 1
      );
    });
  } else {
    return {
      params: {
        filePath: [
          filePath
            ? filePath + "/" + item.name.replace(".md", "")
            : item.name.replace(".md", ""),
        ],
      },
    };
  }
};
