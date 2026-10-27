import assert from "node:assert/strict";
import test from "node:test";
import { assertRepoUrl, humanizeSvnError } from "../src/lib/svn-url.ts";

test("assertRepoUrl accepts common schemes and rejects credentials in URL", () => {
  assert.doesNotThrow(() => assertRepoUrl("https://svn.example.com/order/trunk"));
  assert.doesNotThrow(() => assertRepoUrl("svn://svn.example.com/repo"));
  assert.throws(() => assertRepoUrl("https://user:pass@svn.example.com/repo"), /账号密码/);
  assert.throws(() => assertRepoUrl("ftp://svn.example.com/repo"), /只支持/);
  assert.throws(() => assertRepoUrl("not a url"), /无法识别/);
});

test("assertRepoUrl gates file: behind env flag", () => {
  const previous = process.env.RIZHAI_ALLOW_SVN_FILE_URL;
  try {
    delete process.env.RIZHAI_ALLOW_SVN_FILE_URL;
    // npm test 时 NODE_ENV 通常不是 development，file: 应被拒绝
    if (process.env.NODE_ENV !== "development") {
      assert.throws(() => assertRepoUrl("file:///C:/repos/order"), /RIZHAI_ALLOW_SVN_FILE_URL/);
    }
    process.env.RIZHAI_ALLOW_SVN_FILE_URL = "1";
    assert.doesNotThrow(() => assertRepoUrl("file:///C:/repos/order"));
  } finally {
    if (previous === undefined) delete process.env.RIZHAI_ALLOW_SVN_FILE_URL;
    else process.env.RIZHAI_ALLOW_SVN_FILE_URL = previous;
  }
});

test("humanizeSvnError maps common failures", () => {
  assert.match(humanizeSvnError("svn: E170001: Authorization failed"), /拒绝了登录/);
  assert.match(humanizeSvnError("Unable to connect to a repository"), /连不上/);
  assert.match(humanizeSvnError("svn: E160013: path not found"), /没有这个路径/);
});
