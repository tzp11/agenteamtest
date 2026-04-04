-- TestGraph SQLite Schema
-- 用于存储代码关系图谱和测试覆盖率信息

-- 1. 函数表：存储所有函数/方法的元数据
CREATE TABLE IF NOT EXISTS functions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- 函数名称
  file_path TEXT NOT NULL,               -- 文件路径（相对于项目根目录）
  start_line INTEGER NOT NULL,           -- 起始行号
  end_line INTEGER NOT NULL,             -- 结束行号
  complexity INTEGER DEFAULT 0,          -- 圈复杂度
  language TEXT NOT NULL,                -- 编程语言（js/ts/py/go等）
  signature TEXT,                        -- 函数签名
  is_test BOOLEAN DEFAULT 0,             -- 是否是测试函数
  is_exported BOOLEAN DEFAULT 0,         -- 是否导出
  last_modified INTEGER NOT NULL,        -- 最后修改时间（Unix timestamp）
  git_commit_hash TEXT,                  -- 最后修改的 commit hash
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(name, file_path, start_line)
);

-- 2. 调用关系表：存储函数之间的调用关系
CREATE TABLE IF NOT EXISTS function_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_id INTEGER NOT NULL,            -- 调用者函数 ID
  callee_id INTEGER NOT NULL,            -- 被调用者函数 ID
  call_count INTEGER DEFAULT 1,          -- 调用次数
  call_line INTEGER,                     -- 调用所在行号
  is_direct BOOLEAN DEFAULT 1,           -- 是否直接调用（vs 间接调用）
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (caller_id) REFERENCES functions(id) ON DELETE CASCADE,
  FOREIGN KEY (callee_id) REFERENCES functions(id) ON DELETE CASCADE,
  UNIQUE(caller_id, callee_id, call_line)
);

-- 3. 测试覆盖率表：存储测试对函数的覆盖情况
CREATE TABLE IF NOT EXISTS test_coverage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_function_id INTEGER NOT NULL,     -- 测试函数 ID
  covered_function_id INTEGER NOT NULL,  -- 被覆盖的函数 ID
  coverage_type TEXT NOT NULL,           -- 覆盖类型：direct/indirect/call_chain
  call_depth INTEGER DEFAULT 1,          -- 调用深度
  execution_count INTEGER DEFAULT 0,     -- 执行次数
  last_executed INTEGER,                 -- 最后执行时间
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (test_function_id) REFERENCES functions(id) ON DELETE CASCADE,
  FOREIGN KEY (covered_function_id) REFERENCES functions(id) ON DELETE CASCADE,
  UNIQUE(test_function_id, covered_function_id)
);

-- 4. Git 变更记录表：存储文件变更历史
CREATE TABLE IF NOT EXISTS git_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_hash TEXT NOT NULL,             -- Commit hash
  file_path TEXT NOT NULL,               -- 变更的文件路径
  change_type TEXT NOT NULL,             -- 变更类型：added/modified/deleted
  lines_added INTEGER DEFAULT 0,         -- 新增行数
  lines_deleted INTEGER DEFAULT 0,       -- 删除行数
  author TEXT,                           -- 作者
  timestamp INTEGER NOT NULL,            -- 提交时间
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(commit_hash, file_path)
);

-- 5. 受影响的函数表：存储变更影响的函数
CREATE TABLE IF NOT EXISTS affected_functions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id INTEGER NOT NULL,            -- Git 变更 ID
  function_id INTEGER NOT NULL,          -- 受影响的函数 ID
  impact_type TEXT NOT NULL,             -- 影响类型：direct/indirect/test
  impact_score REAL DEFAULT 0.0,         -- 影响分数（0-1）
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (change_id) REFERENCES git_changes(id) ON DELETE CASCADE,
  FOREIGN KEY (function_id) REFERENCES functions(id) ON DELETE CASCADE,
  UNIQUE(change_id, function_id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_functions_file ON functions(file_path);
CREATE INDEX IF NOT EXISTS idx_functions_name ON functions(name);
CREATE INDEX IF NOT EXISTS idx_functions_is_test ON functions(is_test);
CREATE INDEX IF NOT EXISTS idx_function_calls_caller ON function_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_function_calls_callee ON function_calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_test_coverage_test ON test_coverage(test_function_id);
CREATE INDEX IF NOT EXISTS idx_test_coverage_covered ON test_coverage(covered_function_id);
CREATE INDEX IF NOT EXISTS idx_git_changes_file ON git_changes(file_path);
CREATE INDEX IF NOT EXISTS idx_git_changes_commit ON git_changes(commit_hash);
CREATE INDEX IF NOT EXISTS idx_affected_functions_change ON affected_functions(change_id);
CREATE INDEX IF NOT EXISTS idx_affected_functions_function ON affected_functions(function_id);

-- 视图：未覆盖的函数
CREATE VIEW IF NOT EXISTS uncovered_functions AS
SELECT
  f.id,
  f.name,
  f.file_path,
  f.complexity,
  f.language
FROM functions f
WHERE f.is_test = 0
  AND f.id NOT IN (
    SELECT DISTINCT covered_function_id
    FROM test_coverage
  );

-- 视图：高风险函数（高复杂度且未覆盖）
CREATE VIEW IF NOT EXISTS high_risk_functions AS
SELECT
  f.id,
  f.name,
  f.file_path,
  f.complexity,
  f.language,
  f.last_modified
FROM functions f
WHERE f.is_test = 0
  AND f.complexity >= 10
  AND f.id NOT IN (
    SELECT DISTINCT covered_function_id
    FROM test_coverage
  )
ORDER BY f.complexity DESC, f.last_modified DESC;

-- 视图：测试覆盖率统计
CREATE VIEW IF NOT EXISTS coverage_stats AS
SELECT
  COUNT(DISTINCT f.id) as total_functions,
  COUNT(DISTINCT tc.covered_function_id) as covered_functions,
  ROUND(CAST(COUNT(DISTINCT tc.covered_function_id) AS REAL) / COUNT(DISTINCT f.id) * 100, 2) as coverage_percentage
FROM functions f
LEFT JOIN test_coverage tc ON f.id = tc.covered_function_id
WHERE f.is_test = 0;
