var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/entity.js
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}
var entityKind;
var init_entity = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/entity.js"() {
    entityKind = /* @__PURE__ */ Symbol.for("drizzle:entityKind");
    __name(is, "is");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/logger.js
var ConsoleLogWriter, DefaultLogger, NoopLogger;
var init_logger = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/logger.js"() {
    init_entity();
    ConsoleLogWriter = class {
      static {
        __name(this, "ConsoleLogWriter");
      }
      static [entityKind] = "ConsoleLogWriter";
      write(message) {
        console.log(message);
      }
    };
    DefaultLogger = class {
      static {
        __name(this, "DefaultLogger");
      }
      static [entityKind] = "DefaultLogger";
      writer;
      constructor(config) {
        this.writer = config?.writer ?? new ConsoleLogWriter();
      }
      logQuery(query, params) {
        const stringifiedParams = params.map((p) => {
          try {
            return JSON.stringify(p);
          } catch {
            return String(p);
          }
        });
        const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
        this.writer.write(`Query: ${query}${paramsStr}`);
      }
    };
    NoopLogger = class {
      static {
        __name(this, "NoopLogger");
      }
      static [entityKind] = "NoopLogger";
      logQuery() {
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/table.utils.js
var TableName;
var init_table_utils = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/table.utils.js"() {
    TableName = /* @__PURE__ */ Symbol.for("drizzle:Name");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/table.js
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}
var Schema, Columns, ExtraConfigColumns, OriginalName, BaseName, IsAlias, ExtraConfigBuilder, IsDrizzleTable, Table;
var init_table = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/table.js"() {
    init_entity();
    init_table_utils();
    Schema = /* @__PURE__ */ Symbol.for("drizzle:Schema");
    Columns = /* @__PURE__ */ Symbol.for("drizzle:Columns");
    ExtraConfigColumns = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigColumns");
    OriginalName = /* @__PURE__ */ Symbol.for("drizzle:OriginalName");
    BaseName = /* @__PURE__ */ Symbol.for("drizzle:BaseName");
    IsAlias = /* @__PURE__ */ Symbol.for("drizzle:IsAlias");
    ExtraConfigBuilder = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigBuilder");
    IsDrizzleTable = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleTable");
    Table = class {
      static {
        __name(this, "Table");
      }
      static [entityKind] = "Table";
      /** @internal */
      static Symbol = {
        Name: TableName,
        Schema,
        OriginalName,
        Columns,
        ExtraConfigColumns,
        BaseName,
        IsAlias,
        ExtraConfigBuilder
      };
      /**
       * @internal
       * Can be changed if the table is aliased.
       */
      [TableName];
      /**
       * @internal
       * Used to store the original name of the table, before any aliasing.
       */
      [OriginalName];
      /** @internal */
      [Schema];
      /** @internal */
      [Columns];
      /** @internal */
      [ExtraConfigColumns];
      /**
       *  @internal
       * Used to store the table name before the transformation via the `tableCreator` functions.
       */
      [BaseName];
      /** @internal */
      [IsAlias] = false;
      /** @internal */
      [IsDrizzleTable] = true;
      /** @internal */
      [ExtraConfigBuilder] = void 0;
      constructor(name, schema, baseName) {
        this[TableName] = this[OriginalName] = name;
        this[Schema] = schema;
        this[BaseName] = baseName;
      }
    };
    __name(getTableName, "getTableName");
    __name(getTableUniqueName, "getTableUniqueName");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/column.js
var Column;
var init_column = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/column.js"() {
    init_entity();
    Column = class {
      static {
        __name(this, "Column");
      }
      constructor(table, config) {
        this.table = table;
        this.config = config;
        this.name = config.name;
        this.keyAsName = config.keyAsName;
        this.notNull = config.notNull;
        this.default = config.default;
        this.defaultFn = config.defaultFn;
        this.onUpdateFn = config.onUpdateFn;
        this.hasDefault = config.hasDefault;
        this.primary = config.primaryKey;
        this.isUnique = config.isUnique;
        this.uniqueName = config.uniqueName;
        this.uniqueType = config.uniqueType;
        this.dataType = config.dataType;
        this.columnType = config.columnType;
        this.generated = config.generated;
        this.generatedIdentity = config.generatedIdentity;
      }
      static [entityKind] = "Column";
      name;
      keyAsName;
      primary;
      notNull;
      default;
      defaultFn;
      onUpdateFn;
      hasDefault;
      isUnique;
      uniqueName;
      uniqueType;
      dataType;
      columnType;
      enumValues = void 0;
      generated = void 0;
      generatedIdentity = void 0;
      config;
      mapFromDriverValue(value) {
        return value;
      }
      mapToDriverValue(value) {
        return value;
      }
      // ** @internal */
      shouldDisableInsert() {
        return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/column-builder.js
var ColumnBuilder;
var init_column_builder = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/column-builder.js"() {
    init_entity();
    ColumnBuilder = class {
      static {
        __name(this, "ColumnBuilder");
      }
      static [entityKind] = "ColumnBuilder";
      config;
      constructor(name, dataType, columnType) {
        this.config = {
          name,
          keyAsName: name === "",
          notNull: false,
          default: void 0,
          hasDefault: false,
          primaryKey: false,
          isUnique: false,
          uniqueName: void 0,
          uniqueType: void 0,
          dataType,
          columnType,
          generated: void 0
        };
      }
      /**
       * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
       *
       * @example
       * ```ts
       * const users = pgTable('users', {
       * 	id: integer('id').$type<UserId>().primaryKey(),
       * 	details: json('details').$type<UserDetails>().notNull(),
       * });
       * ```
       */
      $type() {
        return this;
      }
      /**
       * Adds a `not null` clause to the column definition.
       *
       * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
       */
      notNull() {
        this.config.notNull = true;
        return this;
      }
      /**
       * Adds a `default <value>` clause to the column definition.
       *
       * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
       *
       * If you need to set a dynamic default value, use {@link $defaultFn} instead.
       */
      default(value) {
        this.config.default = value;
        this.config.hasDefault = true;
        return this;
      }
      /**
       * Adds a dynamic default value to the column.
       * The function will be called when the row is inserted, and the returned value will be used as the column value.
       *
       * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
       */
      $defaultFn(fn) {
        this.config.defaultFn = fn;
        this.config.hasDefault = true;
        return this;
      }
      /**
       * Alias for {@link $defaultFn}.
       */
      $default = this.$defaultFn;
      /**
       * Adds a dynamic update value to the column.
       * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
       * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
       *
       * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
       */
      $onUpdateFn(fn) {
        this.config.onUpdateFn = fn;
        this.config.hasDefault = true;
        return this;
      }
      /**
       * Alias for {@link $onUpdateFn}.
       */
      $onUpdate = this.$onUpdateFn;
      /**
       * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
       *
       * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
       */
      primaryKey() {
        this.config.primaryKey = true;
        this.config.notNull = true;
        return this;
      }
      /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
      setName(name) {
        if (this.config.name !== "") return;
        this.config.name = name;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/foreign-keys.js
var ForeignKeyBuilder, ForeignKey;
var init_foreign_keys = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/foreign-keys.js"() {
    init_entity();
    init_table_utils();
    ForeignKeyBuilder = class {
      static {
        __name(this, "ForeignKeyBuilder");
      }
      static [entityKind] = "PgForeignKeyBuilder";
      /** @internal */
      reference;
      /** @internal */
      _onUpdate = "no action";
      /** @internal */
      _onDelete = "no action";
      constructor(config, actions) {
        this.reference = () => {
          const { name, columns, foreignColumns } = config();
          return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
        };
        if (actions) {
          this._onUpdate = actions.onUpdate;
          this._onDelete = actions.onDelete;
        }
      }
      onUpdate(action) {
        this._onUpdate = action === void 0 ? "no action" : action;
        return this;
      }
      onDelete(action) {
        this._onDelete = action === void 0 ? "no action" : action;
        return this;
      }
      /** @internal */
      build(table) {
        return new ForeignKey(table, this);
      }
    };
    ForeignKey = class {
      static {
        __name(this, "ForeignKey");
      }
      constructor(table, builder) {
        this.table = table;
        this.reference = builder.reference;
        this.onUpdate = builder._onUpdate;
        this.onDelete = builder._onDelete;
      }
      static [entityKind] = "PgForeignKey";
      reference;
      onUpdate;
      onDelete;
      getName() {
        const { name, columns, foreignColumns } = this.reference();
        const columnNames = columns.map((column) => column.name);
        const foreignColumnNames = foreignColumns.map((column) => column.name);
        const chunks = [
          this.table[TableName],
          ...columnNames,
          foreignColumns[0].table[TableName],
          ...foreignColumnNames
        ];
        return name ?? `${chunks.join("_")}_fk`;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}
var init_tracing_utils = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/tracing-utils.js"() {
    __name(iife, "iife");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder, UniqueOnConstraintBuilder, UniqueConstraint;
var init_unique_constraint = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/unique-constraint.js"() {
    init_entity();
    init_table_utils();
    __name(uniqueKeyName, "uniqueKeyName");
    UniqueConstraintBuilder = class {
      static {
        __name(this, "UniqueConstraintBuilder");
      }
      constructor(columns, name) {
        this.name = name;
        this.columns = columns;
      }
      static [entityKind] = "PgUniqueConstraintBuilder";
      /** @internal */
      columns;
      /** @internal */
      nullsNotDistinctConfig = false;
      nullsNotDistinct() {
        this.nullsNotDistinctConfig = true;
        return this;
      }
      /** @internal */
      build(table) {
        return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
      }
    };
    UniqueOnConstraintBuilder = class {
      static {
        __name(this, "UniqueOnConstraintBuilder");
      }
      static [entityKind] = "PgUniqueOnConstraintBuilder";
      /** @internal */
      name;
      constructor(name) {
        this.name = name;
      }
      on(...columns) {
        return new UniqueConstraintBuilder(columns, this.name);
      }
    };
    UniqueConstraint = class {
      static {
        __name(this, "UniqueConstraint");
      }
      constructor(table, columns, nullsNotDistinct, name) {
        this.table = table;
        this.columns = columns;
        this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
        this.nullsNotDistinct = nullsNotDistinct;
      }
      static [entityKind] = "PgUniqueConstraint";
      columns;
      name;
      nullsNotDistinct = false;
      getName() {
        return this.name;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char = arrayString[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char === "," || char === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char = arrayString[i];
    if (char === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    if (char === "}") {
      return [result, i + 1];
    }
    if (char === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value);
    i = newStartFrom;
  }
  return [result, i];
}
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}
var init_array = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/utils/array.js"() {
    __name(parsePgArrayValue, "parsePgArrayValue");
    __name(parsePgNestedArray, "parsePgNestedArray");
    __name(parsePgArray, "parsePgArray");
    __name(makePgArray, "makePgArray");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder, PgColumn, ExtraConfigColumn, IndexedColumn, PgArrayBuilder, PgArray;
var init_common = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/columns/common.js"() {
    init_column_builder();
    init_column();
    init_entity();
    init_foreign_keys();
    init_tracing_utils();
    init_unique_constraint();
    init_array();
    PgColumnBuilder = class extends ColumnBuilder {
      static {
        __name(this, "PgColumnBuilder");
      }
      foreignKeyConfigs = [];
      static [entityKind] = "PgColumnBuilder";
      array(size) {
        return new PgArrayBuilder(this.config.name, this, size);
      }
      references(ref, actions = {}) {
        this.foreignKeyConfigs.push({ ref, actions });
        return this;
      }
      unique(name, config) {
        this.config.isUnique = true;
        this.config.uniqueName = name;
        this.config.uniqueType = config?.nulls;
        return this;
      }
      generatedAlwaysAs(as) {
        this.config.generated = {
          as,
          type: "always",
          mode: "stored"
        };
        return this;
      }
      /** @internal */
      buildForeignKeys(column, table) {
        return this.foreignKeyConfigs.map(({ ref, actions }) => {
          return iife(
            (ref2, actions2) => {
              const builder = new ForeignKeyBuilder(() => {
                const foreignColumn = ref2();
                return { columns: [column], foreignColumns: [foreignColumn] };
              });
              if (actions2.onUpdate) {
                builder.onUpdate(actions2.onUpdate);
              }
              if (actions2.onDelete) {
                builder.onDelete(actions2.onDelete);
              }
              return builder.build(table);
            },
            ref,
            actions
          );
        });
      }
      /** @internal */
      buildExtraConfigColumn(table) {
        return new ExtraConfigColumn(table, this.config);
      }
    };
    PgColumn = class extends Column {
      static {
        __name(this, "PgColumn");
      }
      constructor(table, config) {
        if (!config.uniqueName) {
          config.uniqueName = uniqueKeyName(table, [config.name]);
        }
        super(table, config);
        this.table = table;
      }
      static [entityKind] = "PgColumn";
    };
    ExtraConfigColumn = class extends PgColumn {
      static {
        __name(this, "ExtraConfigColumn");
      }
      static [entityKind] = "ExtraConfigColumn";
      getSQLType() {
        return this.getSQLType();
      }
      indexConfig = {
        order: this.config.order ?? "asc",
        nulls: this.config.nulls ?? "last",
        opClass: this.config.opClass
      };
      defaultConfig = {
        order: "asc",
        nulls: "last",
        opClass: void 0
      };
      asc() {
        this.indexConfig.order = "asc";
        return this;
      }
      desc() {
        this.indexConfig.order = "desc";
        return this;
      }
      nullsFirst() {
        this.indexConfig.nulls = "first";
        return this;
      }
      nullsLast() {
        this.indexConfig.nulls = "last";
        return this;
      }
      /**
       * ### PostgreSQL documentation quote
       *
       * > An operator class with optional parameters can be specified for each column of an index.
       * The operator class identifies the operators to be used by the index for that column.
       * For example, a B-tree index on four-byte integers would use the int4_ops class;
       * this operator class includes comparison functions for four-byte integers.
       * In practice the default operator class for the column's data type is usually sufficient.
       * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
       * For example, we might want to sort a complex-number data type either by absolute value or by real part.
       * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
       * More information about operator classes check:
       *
       * ### Useful links
       * https://www.postgresql.org/docs/current/sql-createindex.html
       *
       * https://www.postgresql.org/docs/current/indexes-opclass.html
       *
       * https://www.postgresql.org/docs/current/xindex.html
       *
       * ### Additional types
       * If you have the `pg_vector` extension installed in your database, you can use the
       * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
       *
       * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
       *
       * @param opClass
       * @returns
       */
      op(opClass) {
        this.indexConfig.opClass = opClass;
        return this;
      }
    };
    IndexedColumn = class {
      static {
        __name(this, "IndexedColumn");
      }
      static [entityKind] = "IndexedColumn";
      constructor(name, keyAsName, type, indexConfig) {
        this.name = name;
        this.keyAsName = keyAsName;
        this.type = type;
        this.indexConfig = indexConfig;
      }
      name;
      keyAsName;
      type;
      indexConfig;
    };
    PgArrayBuilder = class extends PgColumnBuilder {
      static {
        __name(this, "PgArrayBuilder");
      }
      static [entityKind] = "PgArrayBuilder";
      constructor(name, baseBuilder, size) {
        super(name, "array", "PgArray");
        this.config.baseBuilder = baseBuilder;
        this.config.size = size;
      }
      /** @internal */
      build(table) {
        const baseColumn = this.config.baseBuilder.build(table);
        return new PgArray(
          table,
          this.config,
          baseColumn
        );
      }
    };
    PgArray = class _PgArray extends PgColumn {
      static {
        __name(this, "PgArray");
      }
      constructor(table, config, baseColumn, range) {
        super(table, config);
        this.baseColumn = baseColumn;
        this.range = range;
        this.size = config.size;
      }
      size;
      static [entityKind] = "PgArray";
      getSQLType() {
        return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") {
          value = parsePgArray(value);
        }
        return value.map((v) => this.baseColumn.mapFromDriverValue(v));
      }
      mapToDriverValue(value, isNestedArray = false) {
        const a = value.map(
          (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
        );
        if (isNestedArray) return a;
        return makePgArray(a);
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/columns/enum.js
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
var PgEnumObjectColumnBuilder, PgEnumObjectColumn, isPgEnumSym, PgEnumColumnBuilder, PgEnumColumn;
var init_enum = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/columns/enum.js"() {
    init_entity();
    init_common();
    PgEnumObjectColumnBuilder = class extends PgColumnBuilder {
      static {
        __name(this, "PgEnumObjectColumnBuilder");
      }
      static [entityKind] = "PgEnumObjectColumnBuilder";
      constructor(name, enumInstance) {
        super(name, "string", "PgEnumObjectColumn");
        this.config.enum = enumInstance;
      }
      /** @internal */
      build(table) {
        return new PgEnumObjectColumn(
          table,
          this.config
        );
      }
    };
    PgEnumObjectColumn = class extends PgColumn {
      static {
        __name(this, "PgEnumObjectColumn");
      }
      static [entityKind] = "PgEnumObjectColumn";
      enum;
      enumValues = this.config.enum.enumValues;
      constructor(table, config) {
        super(table, config);
        this.enum = config.enum;
      }
      getSQLType() {
        return this.enum.enumName;
      }
    };
    isPgEnumSym = /* @__PURE__ */ Symbol.for("drizzle:isPgEnum");
    __name(isPgEnum, "isPgEnum");
    PgEnumColumnBuilder = class extends PgColumnBuilder {
      static {
        __name(this, "PgEnumColumnBuilder");
      }
      static [entityKind] = "PgEnumColumnBuilder";
      constructor(name, enumInstance) {
        super(name, "string", "PgEnumColumn");
        this.config.enum = enumInstance;
      }
      /** @internal */
      build(table) {
        return new PgEnumColumn(
          table,
          this.config
        );
      }
    };
    PgEnumColumn = class extends PgColumn {
      static {
        __name(this, "PgEnumColumn");
      }
      static [entityKind] = "PgEnumColumn";
      enum = this.config.enum;
      enumValues = this.config.enum.enumValues;
      constructor(table, config) {
        super(table, config);
        this.enum = config.enum;
      }
      getSQLType() {
        return this.enum.enumName;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/subquery.js
var Subquery, WithSubquery;
var init_subquery = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/subquery.js"() {
    init_entity();
    Subquery = class {
      static {
        __name(this, "Subquery");
      }
      static [entityKind] = "Subquery";
      constructor(sql4, fields, alias, isWith = false, usedTables = []) {
        this._ = {
          brand: "Subquery",
          sql: sql4,
          selectedFields: fields,
          alias,
          isWith,
          usedTables
        };
      }
      // getSQL(): SQL<unknown> {
      // 	return new SQL([this]);
      // }
    };
    WithSubquery = class extends Subquery {
      static {
        __name(this, "WithSubquery");
      }
      static [entityKind] = "WithSubquery";
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/version.js
var version;
var init_version = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/version.js"() {
    version = "0.45.2";
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/tracing.js
var otel, rawTracer, tracer;
var init_tracing = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/tracing.js"() {
    init_tracing_utils();
    init_version();
    tracer = {
      startActiveSpan(name, fn) {
        if (!otel) {
          return fn();
        }
        if (!rawTracer) {
          rawTracer = otel.trace.getTracer("drizzle-orm", version);
        }
        return iife(
          (otel2, rawTracer2) => rawTracer2.startActiveSpan(
            name,
            (span) => {
              try {
                return fn(span);
              } catch (e) {
                span.setStatus({
                  code: otel2.SpanStatusCode.ERROR,
                  message: e instanceof Error ? e.message : "Unknown error"
                  // eslint-disable-line no-instanceof/no-instanceof
                });
                throw e;
              } finally {
                span.end();
              }
            }
          ),
          otel,
          rawTracer
        );
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/view-common.js
var ViewBaseConfig;
var init_view_common = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/view-common.js"() {
    ViewBaseConfig = /* @__PURE__ */ Symbol.for("drizzle:ViewBaseConfig");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/sql.js
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if (query.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
function fillPlaceholders(params, values) {
  return params.map((p) => {
    if (is(p, Placeholder)) {
      if (!(p.name in values)) {
        throw new Error(`No value for placeholder "${p.name}" was provided`);
      }
      return values[p.name];
    }
    if (is(p, Param) && is(p.value, Placeholder)) {
      if (!(p.value.name in values)) {
        throw new Error(`No value for placeholder "${p.value.name}" was provided`);
      }
      return p.encoder.mapToDriverValue(values[p.value.name]);
    }
    return p;
  });
}
var FakePrimitiveParam, StringChunk, SQL, Name, noopDecoder, noopEncoder, noopMapper, Param, Placeholder, IsDrizzleView, View;
var init_sql = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/sql.js"() {
    init_entity();
    init_enum();
    init_subquery();
    init_tracing();
    init_view_common();
    init_column();
    init_table();
    FakePrimitiveParam = class {
      static {
        __name(this, "FakePrimitiveParam");
      }
      static [entityKind] = "FakePrimitiveParam";
    };
    __name(isSQLWrapper, "isSQLWrapper");
    __name(mergeQueries, "mergeQueries");
    StringChunk = class {
      static {
        __name(this, "StringChunk");
      }
      static [entityKind] = "StringChunk";
      value;
      constructor(value) {
        this.value = Array.isArray(value) ? value : [value];
      }
      getSQL() {
        return new SQL([this]);
      }
    };
    SQL = class _SQL {
      static {
        __name(this, "SQL");
      }
      constructor(queryChunks) {
        this.queryChunks = queryChunks;
        for (const chunk of queryChunks) {
          if (is(chunk, Table)) {
            const schemaName = chunk[Table.Symbol.Schema];
            this.usedTables.push(
              schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]
            );
          }
        }
      }
      static [entityKind] = "SQL";
      /** @internal */
      decoder = noopDecoder;
      shouldInlineParams = false;
      /** @internal */
      usedTables = [];
      append(query) {
        this.queryChunks.push(...query.queryChunks);
        return this;
      }
      toQuery(config) {
        return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
          const query = this.buildQueryFromSourceParams(this.queryChunks, config);
          span?.setAttributes({
            "drizzle.query.text": query.sql,
            "drizzle.query.params": JSON.stringify(query.params)
          });
          return query;
        });
      }
      buildQueryFromSourceParams(chunks, _config) {
        const config = Object.assign({}, _config, {
          inlineParams: _config.inlineParams || this.shouldInlineParams,
          paramStartIndex: _config.paramStartIndex || { value: 0 }
        });
        const {
          casing,
          escapeName,
          escapeParam,
          prepareTyping,
          inlineParams,
          paramStartIndex
        } = config;
        return mergeQueries(chunks.map((chunk) => {
          if (is(chunk, StringChunk)) {
            return { sql: chunk.value.join(""), params: [] };
          }
          if (is(chunk, Name)) {
            return { sql: escapeName(chunk.value), params: [] };
          }
          if (chunk === void 0) {
            return { sql: "", params: [] };
          }
          if (Array.isArray(chunk)) {
            const result = [new StringChunk("(")];
            for (const [i, p] of chunk.entries()) {
              result.push(p);
              if (i < chunk.length - 1) {
                result.push(new StringChunk(", "));
              }
            }
            result.push(new StringChunk(")"));
            return this.buildQueryFromSourceParams(result, config);
          }
          if (is(chunk, _SQL)) {
            return this.buildQueryFromSourceParams(chunk.queryChunks, {
              ...config,
              inlineParams: inlineParams || chunk.shouldInlineParams
            });
          }
          if (is(chunk, Table)) {
            const schemaName = chunk[Table.Symbol.Schema];
            const tableName = chunk[Table.Symbol.Name];
            return {
              sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
              params: []
            };
          }
          if (is(chunk, Column)) {
            const columnName = casing.getColumnCasing(chunk);
            if (_config.invokeSource === "indexes") {
              return { sql: escapeName(columnName), params: [] };
            }
            const schemaName = chunk.table[Table.Symbol.Schema];
            return {
              sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
              params: []
            };
          }
          if (is(chunk, View)) {
            const schemaName = chunk[ViewBaseConfig].schema;
            const viewName = chunk[ViewBaseConfig].name;
            return {
              sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
              params: []
            };
          }
          if (is(chunk, Param)) {
            if (is(chunk.value, Placeholder)) {
              return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
            }
            const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
            if (is(mappedValue, _SQL)) {
              return this.buildQueryFromSourceParams([mappedValue], config);
            }
            if (inlineParams) {
              return { sql: this.mapInlineParam(mappedValue, config), params: [] };
            }
            let typings = ["none"];
            if (prepareTyping) {
              typings = [prepareTyping(chunk.encoder)];
            }
            return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
          }
          if (is(chunk, Placeholder)) {
            return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
          }
          if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
            return { sql: escapeName(chunk.fieldAlias), params: [] };
          }
          if (is(chunk, Subquery)) {
            if (chunk._.isWith) {
              return { sql: escapeName(chunk._.alias), params: [] };
            }
            return this.buildQueryFromSourceParams([
              new StringChunk("("),
              chunk._.sql,
              new StringChunk(") "),
              new Name(chunk._.alias)
            ], config);
          }
          if (isPgEnum(chunk)) {
            if (chunk.schema) {
              return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
            }
            return { sql: escapeName(chunk.enumName), params: [] };
          }
          if (isSQLWrapper(chunk)) {
            if (chunk.shouldOmitSQLParens?.()) {
              return this.buildQueryFromSourceParams([chunk.getSQL()], config);
            }
            return this.buildQueryFromSourceParams([
              new StringChunk("("),
              chunk.getSQL(),
              new StringChunk(")")
            ], config);
          }
          if (inlineParams) {
            return { sql: this.mapInlineParam(chunk, config), params: [] };
          }
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }));
      }
      mapInlineParam(chunk, { escapeString }) {
        if (chunk === null) {
          return "null";
        }
        if (typeof chunk === "number" || typeof chunk === "boolean") {
          return chunk.toString();
        }
        if (typeof chunk === "string") {
          return escapeString(chunk);
        }
        if (typeof chunk === "object") {
          const mappedValueAsString = chunk.toString();
          if (mappedValueAsString === "[object Object]") {
            return escapeString(JSON.stringify(chunk));
          }
          return escapeString(mappedValueAsString);
        }
        throw new Error("Unexpected param value: " + chunk);
      }
      getSQL() {
        return this;
      }
      as(alias) {
        if (alias === void 0) {
          return this;
        }
        return new _SQL.Aliased(this, alias);
      }
      mapWith(decoder) {
        this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
        return this;
      }
      inlineParams() {
        this.shouldInlineParams = true;
        return this;
      }
      /**
       * This method is used to conditionally include a part of the query.
       *
       * @param condition - Condition to check
       * @returns itself if the condition is `true`, otherwise `undefined`
       */
      if(condition) {
        return condition ? this : void 0;
      }
    };
    Name = class {
      static {
        __name(this, "Name");
      }
      constructor(value) {
        this.value = value;
      }
      static [entityKind] = "Name";
      brand;
      getSQL() {
        return new SQL([this]);
      }
    };
    __name(isDriverValueEncoder, "isDriverValueEncoder");
    noopDecoder = {
      mapFromDriverValue: /* @__PURE__ */ __name((value) => value, "mapFromDriverValue")
    };
    noopEncoder = {
      mapToDriverValue: /* @__PURE__ */ __name((value) => value, "mapToDriverValue")
    };
    noopMapper = {
      ...noopDecoder,
      ...noopEncoder
    };
    Param = class {
      static {
        __name(this, "Param");
      }
      /**
       * @param value - Parameter value
       * @param encoder - Encoder to convert the value to a driver parameter
       */
      constructor(value, encoder = noopEncoder) {
        this.value = value;
        this.encoder = encoder;
      }
      static [entityKind] = "Param";
      brand;
      getSQL() {
        return new SQL([this]);
      }
    };
    __name(sql, "sql");
    ((sql22) => {
      function empty() {
        return new SQL([]);
      }
      __name(empty, "empty");
      sql22.empty = empty;
      function fromList(list) {
        return new SQL(list);
      }
      __name(fromList, "fromList");
      sql22.fromList = fromList;
      function raw2(str) {
        return new SQL([new StringChunk(str)]);
      }
      __name(raw2, "raw");
      sql22.raw = raw2;
      function join(chunks, separator) {
        const result = [];
        for (const [i, chunk] of chunks.entries()) {
          if (i > 0 && separator !== void 0) {
            result.push(separator);
          }
          result.push(chunk);
        }
        return new SQL(result);
      }
      __name(join, "join");
      sql22.join = join;
      function identifier(value) {
        return new Name(value);
      }
      __name(identifier, "identifier");
      sql22.identifier = identifier;
      function placeholder2(name2) {
        return new Placeholder(name2);
      }
      __name(placeholder2, "placeholder2");
      sql22.placeholder = placeholder2;
      function param2(value, encoder) {
        return new Param(value, encoder);
      }
      __name(param2, "param2");
      sql22.param = param2;
    })(sql || (sql = {}));
    ((SQL2) => {
      class Aliased {
        static {
          __name(this, "Aliased");
        }
        constructor(sql22, fieldAlias) {
          this.sql = sql22;
          this.fieldAlias = fieldAlias;
        }
        static [entityKind] = "SQL.Aliased";
        /** @internal */
        isSelectionField = false;
        getSQL() {
          return this.sql;
        }
        /** @internal */
        clone() {
          return new Aliased(this.sql, this.fieldAlias);
        }
      }
      SQL2.Aliased = Aliased;
    })(SQL || (SQL = {}));
    Placeholder = class {
      static {
        __name(this, "Placeholder");
      }
      constructor(name2) {
        this.name = name2;
      }
      static [entityKind] = "Placeholder";
      getSQL() {
        return new SQL([this]);
      }
    };
    __name(fillPlaceholders, "fillPlaceholders");
    IsDrizzleView = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleView");
    View = class {
      static {
        __name(this, "View");
      }
      static [entityKind] = "View";
      /** @internal */
      [ViewBaseConfig];
      /** @internal */
      [IsDrizzleView] = true;
      constructor({ name: name2, schema, selectedFields, query }) {
        this[ViewBaseConfig] = {
          name: name2,
          originalName: name2,
          schema,
          selectedFields,
          query,
          isExisting: !query,
          isAlias: false
        };
      }
      getSQL() {
        return new SQL([this]);
      }
    };
    Column.prototype.getSQL = function() {
      return new SQL([this]);
    };
    Table.prototype.getSQL = function() {
      return new SQL([this]);
    };
    Subquery.prototype.getSQL = function() {
      return new SQL([this]);
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/utils.js
function mapResultRow(columns, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns.reduce(
    (result2, { path, field }, columnIndex) => {
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else if (is(field, Subquery)) {
        decoder = field._.sql.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name, field]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased) || is(field, Subquery)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index2, key] of leftKeys.entries()) {
    if (key !== rightKeys[index2]) {
      return false;
    }
  }
  return true;
}
function mapUpdateSet(table, values) {
  const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
    if (is(value, SQL) || is(value, Column)) {
      return [key, value];
    } else {
      return [key, new Param(value, table[Table.Symbol.Columns][key])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor") continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a, b) {
  return {
    name: typeof a === "string" && a.length > 0 ? a : "",
    config: typeof a === "object" ? a : b
  };
}
var textDecoder;
var init_utils = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/utils.js"() {
    init_column();
    init_entity();
    init_sql();
    init_subquery();
    init_table();
    init_view_common();
    __name(mapResultRow, "mapResultRow");
    __name(orderSelectedFields, "orderSelectedFields");
    __name(haveSameKeys, "haveSameKeys");
    __name(mapUpdateSet, "mapUpdateSet");
    __name(applyMixins, "applyMixins");
    __name(getTableColumns, "getTableColumns");
    __name(getTableLikeName, "getTableLikeName");
    __name(getColumnNameAndConfig, "getColumnNameAndConfig");
    textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/table.js
var InlineForeignKeys, EnableRLS, PgTable;
var init_table2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/table.js"() {
    init_entity();
    init_table();
    InlineForeignKeys = /* @__PURE__ */ Symbol.for("drizzle:PgInlineForeignKeys");
    EnableRLS = /* @__PURE__ */ Symbol.for("drizzle:EnableRLS");
    PgTable = class extends Table {
      static {
        __name(this, "PgTable");
      }
      static [entityKind] = "PgTable";
      /** @internal */
      static Symbol = Object.assign({}, Table.Symbol, {
        InlineForeignKeys,
        EnableRLS
      });
      /**@internal */
      [InlineForeignKeys] = [];
      /** @internal */
      [EnableRLS] = false;
      /** @internal */
      [Table.Symbol.ExtraConfigBuilder] = void 0;
      /** @internal */
      [Table.Symbol.ExtraConfigColumns] = {};
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/primary-keys.js
var PrimaryKeyBuilder, PrimaryKey;
var init_primary_keys = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/pg-core/primary-keys.js"() {
    init_entity();
    init_table2();
    PrimaryKeyBuilder = class {
      static {
        __name(this, "PrimaryKeyBuilder");
      }
      static [entityKind] = "PgPrimaryKeyBuilder";
      /** @internal */
      columns;
      /** @internal */
      name;
      constructor(columns, name) {
        this.columns = columns;
        this.name = name;
      }
      /** @internal */
      build(table) {
        return new PrimaryKey(table, this.columns, this.name);
      }
    };
    PrimaryKey = class {
      static {
        __name(this, "PrimaryKey");
      }
      constructor(table, columns, name) {
        this.table = table;
        this.columns = columns;
        this.name = name;
      }
      static [entityKind] = "PgPrimaryKey";
      columns;
      name;
      getName() {
        return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
function not(condition) {
  return sql`not ${condition}`;
}
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
  return sql`${value} is null`;
}
function isNotNull(value) {
  return sql`${value} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
  return sql`${column} like ${value}`;
}
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}
var eq, ne, gt, gte, lt, lte;
var init_conditions = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/expressions/conditions.js"() {
    init_column();
    init_entity();
    init_table();
    init_sql();
    __name(bindIfParam, "bindIfParam");
    eq = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} = ${bindIfParam(right, left)}`;
    }, "eq");
    ne = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} <> ${bindIfParam(right, left)}`;
    }, "ne");
    __name(and, "and");
    __name(or, "or");
    __name(not, "not");
    gt = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} > ${bindIfParam(right, left)}`;
    }, "gt");
    gte = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} >= ${bindIfParam(right, left)}`;
    }, "gte");
    lt = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} < ${bindIfParam(right, left)}`;
    }, "lt");
    lte = /* @__PURE__ */ __name((left, right) => {
      return sql`${left} <= ${bindIfParam(right, left)}`;
    }, "lte");
    __name(inArray, "inArray");
    __name(notInArray, "notInArray");
    __name(isNull, "isNull");
    __name(isNotNull, "isNotNull");
    __name(exists, "exists");
    __name(notExists, "notExists");
    __name(between, "between");
    __name(notBetween, "notBetween");
    __name(like, "like");
    __name(notLike, "notLike");
    __name(ilike, "ilike");
    __name(notIlike, "notIlike");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
  return sql`${column} asc`;
}
function desc(column) {
  return sql`${column} desc`;
}
var init_select = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/expressions/select.js"() {
    init_sql();
    __name(asc, "asc");
    __name(desc, "desc");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/expressions/index.js
var init_expressions = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/expressions/index.js"() {
    init_conditions();
    init_select();
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/relations.js
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
function extractTablesRelationalConfig(schema, configHelpers) {
  if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) {
    schema = schema["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key, value] of Object.entries(schema)) {
    if (is(value, Table)) {
      const dbName = getTableUniqueName(value);
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key;
      tablesConfig[key] = {
        tsName: key,
        dbName: value[Table.Symbol.Name],
        schema: value[Table.Symbol.Schema],
        columns: value[Table.Symbol.Columns],
        relations: bufferedRelations?.relations ?? {},
        primaryKey: bufferedRelations?.primaryKey ?? []
      };
      for (const column of Object.values(
        value[Table.Symbol.Columns]
      )) {
        if (column.primary) {
          tablesConfig[key].primaryKey.push(column);
        }
      }
      const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value, Relations)) {
      const dbName = getTableUniqueName(value.table);
      const tableName = tableNamesMap[dbName];
      const relations2 = value.config(
        configHelpers(value.table)
      );
      let primaryKey;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
          if (primaryKey) {
            tableConfig.primaryKey.push(...primaryKey);
          }
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
function createOne(sourceTable) {
  return /* @__PURE__ */ __name(function one(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      config?.fields.reduce((res, f) => res && f.notNull, true) ?? false
    );
  }, "one");
}
function createMany(sourceTable) {
  return /* @__PURE__ */ __name(function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  }, "many");
}
function normalizeRelation(schema, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value = mapColumnValue(row[selectionItemIndex]);
      const field = selectionItem.field;
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
    }
  }
  return result;
}
var Relation, Relations, One, Many;
var init_relations = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/relations.js"() {
    init_table();
    init_column();
    init_entity();
    init_primary_keys();
    init_expressions();
    init_sql();
    Relation = class {
      static {
        __name(this, "Relation");
      }
      constructor(sourceTable, referencedTable, relationName) {
        this.sourceTable = sourceTable;
        this.referencedTable = referencedTable;
        this.relationName = relationName;
        this.referencedTableName = referencedTable[Table.Symbol.Name];
      }
      static [entityKind] = "Relation";
      referencedTableName;
      fieldName;
    };
    Relations = class {
      static {
        __name(this, "Relations");
      }
      constructor(table, config) {
        this.table = table;
        this.config = config;
      }
      static [entityKind] = "Relations";
    };
    One = class _One extends Relation {
      static {
        __name(this, "One");
      }
      constructor(sourceTable, referencedTable, config, isNullable) {
        super(sourceTable, referencedTable, config?.relationName);
        this.config = config;
        this.isNullable = isNullable;
      }
      static [entityKind] = "One";
      withFieldName(fieldName) {
        const relation = new _One(
          this.sourceTable,
          this.referencedTable,
          this.config,
          this.isNullable
        );
        relation.fieldName = fieldName;
        return relation;
      }
    };
    Many = class _Many extends Relation {
      static {
        __name(this, "Many");
      }
      constructor(sourceTable, referencedTable, config) {
        super(sourceTable, referencedTable, config?.relationName);
        this.config = config;
      }
      static [entityKind] = "Many";
      withFieldName(fieldName) {
        const relation = new _Many(
          this.sourceTable,
          this.referencedTable,
          this.config
        );
        relation.fieldName = fieldName;
        return relation;
      }
    };
    __name(getOperators, "getOperators");
    __name(getOrderByOperators, "getOrderByOperators");
    __name(extractTablesRelationalConfig, "extractTablesRelationalConfig");
    __name(createOne, "createOne");
    __name(createMany, "createMany");
    __name(normalizeRelation, "normalizeRelation");
    __name(createTableRelationsHelpers, "createTableRelationsHelpers");
    __name(mapRelationalRow, "mapRelationalRow");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/alias.js
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
function mapColumnsInSQLToAlias(query, alias) {
  return sql.join(query.queryChunks.map((c) => {
    if (is(c, Column)) {
      return aliasedTableColumn(c, alias);
    }
    if (is(c, SQL)) {
      return mapColumnsInSQLToAlias(c, alias);
    }
    if (is(c, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c, alias);
    }
    return c;
  }));
}
var ColumnAliasProxyHandler, TableAliasProxyHandler, RelationTableAliasProxyHandler;
var init_alias = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/alias.js"() {
    init_column();
    init_entity();
    init_sql();
    init_table();
    init_view_common();
    ColumnAliasProxyHandler = class {
      static {
        __name(this, "ColumnAliasProxyHandler");
      }
      constructor(table) {
        this.table = table;
      }
      static [entityKind] = "ColumnAliasProxyHandler";
      get(columnObj, prop) {
        if (prop === "table") {
          return this.table;
        }
        return columnObj[prop];
      }
    };
    TableAliasProxyHandler = class {
      static {
        __name(this, "TableAliasProxyHandler");
      }
      constructor(alias, replaceOriginalName) {
        this.alias = alias;
        this.replaceOriginalName = replaceOriginalName;
      }
      static [entityKind] = "TableAliasProxyHandler";
      get(target, prop) {
        if (prop === Table.Symbol.IsAlias) {
          return true;
        }
        if (prop === Table.Symbol.Name) {
          return this.alias;
        }
        if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
          return this.alias;
        }
        if (prop === ViewBaseConfig) {
          return {
            ...target[ViewBaseConfig],
            name: this.alias,
            isAlias: true
          };
        }
        if (prop === Table.Symbol.Columns) {
          const columns = target[Table.Symbol.Columns];
          if (!columns) {
            return columns;
          }
          const proxiedColumns = {};
          Object.keys(columns).map((key) => {
            proxiedColumns[key] = new Proxy(
              columns[key],
              new ColumnAliasProxyHandler(new Proxy(target, this))
            );
          });
          return proxiedColumns;
        }
        const value = target[prop];
        if (is(value, Column)) {
          return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
        }
        return value;
      }
    };
    RelationTableAliasProxyHandler = class {
      static {
        __name(this, "RelationTableAliasProxyHandler");
      }
      constructor(alias) {
        this.alias = alias;
      }
      static [entityKind] = "RelationTableAliasProxyHandler";
      get(target, prop) {
        if (prop === "sourceTable") {
          return aliasedTable(target.sourceTable, this.alias);
        }
        return target[prop];
      }
    };
    __name(aliasedTable, "aliasedTable");
    __name(aliasedTableColumn, "aliasedTableColumn");
    __name(mapColumnsInAliasedSQLToAlias, "mapColumnsInAliasedSQLToAlias");
    __name(mapColumnsInSQLToAlias, "mapColumnsInSQLToAlias");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler;
var init_selection_proxy = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/selection-proxy.js"() {
    init_alias();
    init_column();
    init_entity();
    init_sql();
    init_subquery();
    init_view_common();
    SelectionProxyHandler = class _SelectionProxyHandler {
      static {
        __name(this, "SelectionProxyHandler");
      }
      static [entityKind] = "SelectionProxyHandler";
      config;
      constructor(config) {
        this.config = { ...config };
      }
      get(subquery, prop) {
        if (prop === "_") {
          return {
            ...subquery["_"],
            selectedFields: new Proxy(
              subquery._.selectedFields,
              this
            )
          };
        }
        if (prop === ViewBaseConfig) {
          return {
            ...subquery[ViewBaseConfig],
            selectedFields: new Proxy(
              subquery[ViewBaseConfig].selectedFields,
              this
            )
          };
        }
        if (typeof prop === "symbol") {
          return subquery[prop];
        }
        const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
        const value = columns[prop];
        if (is(value, SQL.Aliased)) {
          if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
            return value.sql;
          }
          const newValue = value.clone();
          newValue.isSelectionField = true;
          return newValue;
        }
        if (is(value, SQL)) {
          if (this.config.sqlBehavior === "sql") {
            return value;
          }
          throw new Error(
            `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
          );
        }
        if (is(value, Column)) {
          if (this.config.alias) {
            return new Proxy(
              value,
              new ColumnAliasProxyHandler(
                new Proxy(
                  value.table,
                  new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
                )
              )
            );
          }
          return value;
        }
        if (typeof value !== "object" || value === null) {
          return value;
        }
        return new Proxy(value, new _SelectionProxyHandler(this.config));
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/query-promise.js
var QueryPromise;
var init_query_promise = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/query-promise.js"() {
    init_entity();
    QueryPromise = class {
      static {
        __name(this, "QueryPromise");
      }
      static [entityKind] = "QueryPromise";
      [Symbol.toStringTag] = "QueryPromise";
      catch(onRejected) {
        return this.then(void 0, onRejected);
      }
      finally(onFinally) {
        return this.then(
          (value) => {
            onFinally?.();
            return value;
          },
          (reason) => {
            onFinally?.();
            throw reason;
          }
        );
      }
      then(onFulfilled, onRejected) {
        return this.execute().then(onFulfilled, onRejected);
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/foreign-keys.js
var ForeignKeyBuilder2, ForeignKey2;
var init_foreign_keys2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/foreign-keys.js"() {
    init_entity();
    init_table_utils();
    ForeignKeyBuilder2 = class {
      static {
        __name(this, "ForeignKeyBuilder");
      }
      static [entityKind] = "SQLiteForeignKeyBuilder";
      /** @internal */
      reference;
      /** @internal */
      _onUpdate;
      /** @internal */
      _onDelete;
      constructor(config, actions) {
        this.reference = () => {
          const { name, columns, foreignColumns } = config();
          return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
        };
        if (actions) {
          this._onUpdate = actions.onUpdate;
          this._onDelete = actions.onDelete;
        }
      }
      onUpdate(action) {
        this._onUpdate = action;
        return this;
      }
      onDelete(action) {
        this._onDelete = action;
        return this;
      }
      /** @internal */
      build(table) {
        return new ForeignKey2(table, this);
      }
    };
    ForeignKey2 = class {
      static {
        __name(this, "ForeignKey");
      }
      constructor(table, builder) {
        this.table = table;
        this.reference = builder.reference;
        this.onUpdate = builder._onUpdate;
        this.onDelete = builder._onDelete;
      }
      static [entityKind] = "SQLiteForeignKey";
      reference;
      onUpdate;
      onDelete;
      getName() {
        const { name, columns, foreignColumns } = this.reference();
        const columnNames = columns.map((column) => column.name);
        const foreignColumnNames = foreignColumns.map((column) => column.name);
        const chunks = [
          this.table[TableName],
          ...columnNames,
          foreignColumns[0].table[TableName],
          ...foreignColumnNames
        ];
        return name ?? `${chunks.join("_")}_fk`;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/unique-constraint.js
function uniqueKeyName2(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder2, UniqueOnConstraintBuilder2, UniqueConstraint2;
var init_unique_constraint2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/unique-constraint.js"() {
    init_entity();
    init_table_utils();
    __name(uniqueKeyName2, "uniqueKeyName");
    UniqueConstraintBuilder2 = class {
      static {
        __name(this, "UniqueConstraintBuilder");
      }
      constructor(columns, name) {
        this.name = name;
        this.columns = columns;
      }
      static [entityKind] = "SQLiteUniqueConstraintBuilder";
      /** @internal */
      columns;
      /** @internal */
      build(table) {
        return new UniqueConstraint2(table, this.columns, this.name);
      }
    };
    UniqueOnConstraintBuilder2 = class {
      static {
        __name(this, "UniqueOnConstraintBuilder");
      }
      static [entityKind] = "SQLiteUniqueOnConstraintBuilder";
      /** @internal */
      name;
      constructor(name) {
        this.name = name;
      }
      on(...columns) {
        return new UniqueConstraintBuilder2(columns, this.name);
      }
    };
    UniqueConstraint2 = class {
      static {
        __name(this, "UniqueConstraint");
      }
      constructor(table, columns, name) {
        this.table = table;
        this.columns = columns;
        this.name = name ?? uniqueKeyName2(this.table, this.columns.map((column) => column.name));
      }
      static [entityKind] = "SQLiteUniqueConstraint";
      columns;
      name;
      getName() {
        return this.name;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/common.js
var SQLiteColumnBuilder, SQLiteColumn;
var init_common2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/common.js"() {
    init_column_builder();
    init_column();
    init_entity();
    init_foreign_keys2();
    init_unique_constraint2();
    SQLiteColumnBuilder = class extends ColumnBuilder {
      static {
        __name(this, "SQLiteColumnBuilder");
      }
      static [entityKind] = "SQLiteColumnBuilder";
      foreignKeyConfigs = [];
      references(ref, actions = {}) {
        this.foreignKeyConfigs.push({ ref, actions });
        return this;
      }
      unique(name) {
        this.config.isUnique = true;
        this.config.uniqueName = name;
        return this;
      }
      generatedAlwaysAs(as, config) {
        this.config.generated = {
          as,
          type: "always",
          mode: config?.mode ?? "virtual"
        };
        return this;
      }
      /** @internal */
      buildForeignKeys(column, table) {
        return this.foreignKeyConfigs.map(({ ref, actions }) => {
          return ((ref2, actions2) => {
            const builder = new ForeignKeyBuilder2(() => {
              const foreignColumn = ref2();
              return { columns: [column], foreignColumns: [foreignColumn] };
            });
            if (actions2.onUpdate) {
              builder.onUpdate(actions2.onUpdate);
            }
            if (actions2.onDelete) {
              builder.onDelete(actions2.onDelete);
            }
            return builder.build(table);
          })(ref, actions);
        });
      }
    };
    SQLiteColumn = class extends Column {
      static {
        __name(this, "SQLiteColumn");
      }
      constructor(table, config) {
        if (!config.uniqueName) {
          config.uniqueName = uniqueKeyName2(table, [config.name]);
        }
        super(table, config);
        this.table = table;
      }
      static [entityKind] = "SQLiteColumn";
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/blob.js
function blob(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "json") {
    return new SQLiteBlobJsonBuilder(name);
  }
  if (config?.mode === "bigint") {
    return new SQLiteBigIntBuilder(name);
  }
  return new SQLiteBlobBufferBuilder(name);
}
var SQLiteBigIntBuilder, SQLiteBigInt, SQLiteBlobJsonBuilder, SQLiteBlobJson, SQLiteBlobBufferBuilder, SQLiteBlobBuffer;
var init_blob = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/blob.js"() {
    init_entity();
    init_utils();
    init_common2();
    SQLiteBigIntBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteBigIntBuilder");
      }
      static [entityKind] = "SQLiteBigIntBuilder";
      constructor(name) {
        super(name, "bigint", "SQLiteBigInt");
      }
      /** @internal */
      build(table) {
        return new SQLiteBigInt(table, this.config);
      }
    };
    SQLiteBigInt = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteBigInt");
      }
      static [entityKind] = "SQLiteBigInt";
      getSQLType() {
        return "blob";
      }
      mapFromDriverValue(value) {
        if (typeof Buffer !== "undefined" && Buffer.from) {
          const buf = Buffer.isBuffer(value) ? value : value instanceof ArrayBuffer ? Buffer.from(value) : value.buffer ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
          return BigInt(buf.toString("utf8"));
        }
        return BigInt(textDecoder.decode(value));
      }
      mapToDriverValue(value) {
        return Buffer.from(value.toString());
      }
    };
    SQLiteBlobJsonBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteBlobJsonBuilder");
      }
      static [entityKind] = "SQLiteBlobJsonBuilder";
      constructor(name) {
        super(name, "json", "SQLiteBlobJson");
      }
      /** @internal */
      build(table) {
        return new SQLiteBlobJson(
          table,
          this.config
        );
      }
    };
    SQLiteBlobJson = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteBlobJson");
      }
      static [entityKind] = "SQLiteBlobJson";
      getSQLType() {
        return "blob";
      }
      mapFromDriverValue(value) {
        if (typeof Buffer !== "undefined" && Buffer.from) {
          const buf = Buffer.isBuffer(value) ? value : value instanceof ArrayBuffer ? Buffer.from(value) : value.buffer ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
          return JSON.parse(buf.toString("utf8"));
        }
        return JSON.parse(textDecoder.decode(value));
      }
      mapToDriverValue(value) {
        return Buffer.from(JSON.stringify(value));
      }
    };
    SQLiteBlobBufferBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteBlobBufferBuilder");
      }
      static [entityKind] = "SQLiteBlobBufferBuilder";
      constructor(name) {
        super(name, "buffer", "SQLiteBlobBuffer");
      }
      /** @internal */
      build(table) {
        return new SQLiteBlobBuffer(table, this.config);
      }
    };
    SQLiteBlobBuffer = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteBlobBuffer");
      }
      static [entityKind] = "SQLiteBlobBuffer";
      mapFromDriverValue(value) {
        if (Buffer.isBuffer(value)) {
          return value;
        }
        return Buffer.from(value);
      }
      getSQLType() {
        return "blob";
      }
    };
    __name(blob, "blob");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/custom.js
function customType(customTypeParams) {
  return (a, b) => {
    const { name, config } = getColumnNameAndConfig(a, b);
    return new SQLiteCustomColumnBuilder(
      name,
      config,
      customTypeParams
    );
  };
}
var SQLiteCustomColumnBuilder, SQLiteCustomColumn;
var init_custom = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/custom.js"() {
    init_entity();
    init_utils();
    init_common2();
    SQLiteCustomColumnBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteCustomColumnBuilder");
      }
      static [entityKind] = "SQLiteCustomColumnBuilder";
      constructor(name, fieldConfig, customTypeParams) {
        super(name, "custom", "SQLiteCustomColumn");
        this.config.fieldConfig = fieldConfig;
        this.config.customTypeParams = customTypeParams;
      }
      /** @internal */
      build(table) {
        return new SQLiteCustomColumn(
          table,
          this.config
        );
      }
    };
    SQLiteCustomColumn = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteCustomColumn");
      }
      static [entityKind] = "SQLiteCustomColumn";
      sqlName;
      mapTo;
      mapFrom;
      constructor(table, config) {
        super(table, config);
        this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
        this.mapTo = config.customTypeParams.toDriver;
        this.mapFrom = config.customTypeParams.fromDriver;
      }
      getSQLType() {
        return this.sqlName;
      }
      mapFromDriverValue(value) {
        return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
      }
      mapToDriverValue(value) {
        return typeof this.mapTo === "function" ? this.mapTo(value) : value;
      }
    };
    __name(customType, "customType");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/integer.js
function integer(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "timestamp" || config?.mode === "timestamp_ms") {
    return new SQLiteTimestampBuilder(name, config.mode);
  }
  if (config?.mode === "boolean") {
    return new SQLiteBooleanBuilder(name, config.mode);
  }
  return new SQLiteIntegerBuilder(name);
}
var SQLiteBaseIntegerBuilder, SQLiteBaseInteger, SQLiteIntegerBuilder, SQLiteInteger, SQLiteTimestampBuilder, SQLiteTimestamp, SQLiteBooleanBuilder, SQLiteBoolean;
var init_integer = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/integer.js"() {
    init_entity();
    init_sql();
    init_utils();
    init_common2();
    SQLiteBaseIntegerBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteBaseIntegerBuilder");
      }
      static [entityKind] = "SQLiteBaseIntegerBuilder";
      constructor(name, dataType, columnType) {
        super(name, dataType, columnType);
        this.config.autoIncrement = false;
      }
      primaryKey(config) {
        if (config?.autoIncrement) {
          this.config.autoIncrement = true;
        }
        this.config.hasDefault = true;
        return super.primaryKey();
      }
    };
    SQLiteBaseInteger = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteBaseInteger");
      }
      static [entityKind] = "SQLiteBaseInteger";
      autoIncrement = this.config.autoIncrement;
      getSQLType() {
        return "integer";
      }
    };
    SQLiteIntegerBuilder = class extends SQLiteBaseIntegerBuilder {
      static {
        __name(this, "SQLiteIntegerBuilder");
      }
      static [entityKind] = "SQLiteIntegerBuilder";
      constructor(name) {
        super(name, "number", "SQLiteInteger");
      }
      build(table) {
        return new SQLiteInteger(
          table,
          this.config
        );
      }
    };
    SQLiteInteger = class extends SQLiteBaseInteger {
      static {
        __name(this, "SQLiteInteger");
      }
      static [entityKind] = "SQLiteInteger";
    };
    SQLiteTimestampBuilder = class extends SQLiteBaseIntegerBuilder {
      static {
        __name(this, "SQLiteTimestampBuilder");
      }
      static [entityKind] = "SQLiteTimestampBuilder";
      constructor(name, mode) {
        super(name, "date", "SQLiteTimestamp");
        this.config.mode = mode;
      }
      /**
       * @deprecated Use `default()` with your own expression instead.
       *
       * Adds `DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))` to the column, which is the current epoch timestamp in milliseconds.
       */
      defaultNow() {
        return this.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`);
      }
      build(table) {
        return new SQLiteTimestamp(
          table,
          this.config
        );
      }
    };
    SQLiteTimestamp = class extends SQLiteBaseInteger {
      static {
        __name(this, "SQLiteTimestamp");
      }
      static [entityKind] = "SQLiteTimestamp";
      mode = this.config.mode;
      mapFromDriverValue(value) {
        if (this.config.mode === "timestamp") {
          return new Date(value * 1e3);
        }
        return new Date(value);
      }
      mapToDriverValue(value) {
        const unix = value.getTime();
        if (this.config.mode === "timestamp") {
          return Math.floor(unix / 1e3);
        }
        return unix;
      }
    };
    SQLiteBooleanBuilder = class extends SQLiteBaseIntegerBuilder {
      static {
        __name(this, "SQLiteBooleanBuilder");
      }
      static [entityKind] = "SQLiteBooleanBuilder";
      constructor(name, mode) {
        super(name, "boolean", "SQLiteBoolean");
        this.config.mode = mode;
      }
      build(table) {
        return new SQLiteBoolean(
          table,
          this.config
        );
      }
    };
    SQLiteBoolean = class extends SQLiteBaseInteger {
      static {
        __name(this, "SQLiteBoolean");
      }
      static [entityKind] = "SQLiteBoolean";
      mode = this.config.mode;
      mapFromDriverValue(value) {
        return Number(value) === 1;
      }
      mapToDriverValue(value) {
        return value ? 1 : 0;
      }
    };
    __name(integer, "integer");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/numeric.js
function numeric(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  const mode = config?.mode;
  return mode === "number" ? new SQLiteNumericNumberBuilder(name) : mode === "bigint" ? new SQLiteNumericBigIntBuilder(name) : new SQLiteNumericBuilder(name);
}
var SQLiteNumericBuilder, SQLiteNumeric, SQLiteNumericNumberBuilder, SQLiteNumericNumber, SQLiteNumericBigIntBuilder, SQLiteNumericBigInt;
var init_numeric = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/numeric.js"() {
    init_entity();
    init_utils();
    init_common2();
    SQLiteNumericBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteNumericBuilder");
      }
      static [entityKind] = "SQLiteNumericBuilder";
      constructor(name) {
        super(name, "string", "SQLiteNumeric");
      }
      /** @internal */
      build(table) {
        return new SQLiteNumeric(
          table,
          this.config
        );
      }
    };
    SQLiteNumeric = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteNumeric");
      }
      static [entityKind] = "SQLiteNumeric";
      mapFromDriverValue(value) {
        if (typeof value === "string") return value;
        return String(value);
      }
      getSQLType() {
        return "numeric";
      }
    };
    SQLiteNumericNumberBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteNumericNumberBuilder");
      }
      static [entityKind] = "SQLiteNumericNumberBuilder";
      constructor(name) {
        super(name, "number", "SQLiteNumericNumber");
      }
      /** @internal */
      build(table) {
        return new SQLiteNumericNumber(
          table,
          this.config
        );
      }
    };
    SQLiteNumericNumber = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteNumericNumber");
      }
      static [entityKind] = "SQLiteNumericNumber";
      mapFromDriverValue(value) {
        if (typeof value === "number") return value;
        return Number(value);
      }
      mapToDriverValue = String;
      getSQLType() {
        return "numeric";
      }
    };
    SQLiteNumericBigIntBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteNumericBigIntBuilder");
      }
      static [entityKind] = "SQLiteNumericBigIntBuilder";
      constructor(name) {
        super(name, "bigint", "SQLiteNumericBigInt");
      }
      /** @internal */
      build(table) {
        return new SQLiteNumericBigInt(
          table,
          this.config
        );
      }
    };
    SQLiteNumericBigInt = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteNumericBigInt");
      }
      static [entityKind] = "SQLiteNumericBigInt";
      mapFromDriverValue = BigInt;
      mapToDriverValue = String;
      getSQLType() {
        return "numeric";
      }
    };
    __name(numeric, "numeric");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/real.js
function real(name) {
  return new SQLiteRealBuilder(name ?? "");
}
var SQLiteRealBuilder, SQLiteReal;
var init_real = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/real.js"() {
    init_entity();
    init_common2();
    SQLiteRealBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteRealBuilder");
      }
      static [entityKind] = "SQLiteRealBuilder";
      constructor(name) {
        super(name, "number", "SQLiteReal");
      }
      /** @internal */
      build(table) {
        return new SQLiteReal(table, this.config);
      }
    };
    SQLiteReal = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteReal");
      }
      static [entityKind] = "SQLiteReal";
      getSQLType() {
        return "real";
      }
    };
    __name(real, "real");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/text.js
function text(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "json") {
    return new SQLiteTextJsonBuilder(name);
  }
  return new SQLiteTextBuilder(name, config);
}
var SQLiteTextBuilder, SQLiteText, SQLiteTextJsonBuilder, SQLiteTextJson;
var init_text = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/text.js"() {
    init_entity();
    init_utils();
    init_common2();
    SQLiteTextBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteTextBuilder");
      }
      static [entityKind] = "SQLiteTextBuilder";
      constructor(name, config) {
        super(name, "string", "SQLiteText");
        this.config.enumValues = config.enum;
        this.config.length = config.length;
      }
      /** @internal */
      build(table) {
        return new SQLiteText(
          table,
          this.config
        );
      }
    };
    SQLiteText = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteText");
      }
      static [entityKind] = "SQLiteText";
      enumValues = this.config.enumValues;
      length = this.config.length;
      constructor(table, config) {
        super(table, config);
      }
      getSQLType() {
        return `text${this.config.length ? `(${this.config.length})` : ""}`;
      }
    };
    SQLiteTextJsonBuilder = class extends SQLiteColumnBuilder {
      static {
        __name(this, "SQLiteTextJsonBuilder");
      }
      static [entityKind] = "SQLiteTextJsonBuilder";
      constructor(name) {
        super(name, "json", "SQLiteTextJson");
      }
      /** @internal */
      build(table) {
        return new SQLiteTextJson(
          table,
          this.config
        );
      }
    };
    SQLiteTextJson = class extends SQLiteColumn {
      static {
        __name(this, "SQLiteTextJson");
      }
      static [entityKind] = "SQLiteTextJson";
      getSQLType() {
        return "text";
      }
      mapFromDriverValue(value) {
        return JSON.parse(value);
      }
      mapToDriverValue(value) {
        return JSON.stringify(value);
      }
    };
    __name(text, "text");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/all.js
function getSQLiteColumnBuilders() {
  return {
    blob,
    customType,
    integer,
    numeric,
    real,
    text
  };
}
var init_all = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/all.js"() {
    init_blob();
    init_custom();
    init_integer();
    init_numeric();
    init_real();
    init_text();
    __name(getSQLiteColumnBuilders, "getSQLiteColumnBuilders");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/table.js
function sqliteTableBase(name, columns, extraConfig, schema, baseName = name) {
  const rawTable = new SQLiteTable(name, schema, baseName);
  const parsedColumns = typeof columns === "function" ? columns(getSQLiteColumnBuilders()) : columns;
  const builtColumns = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys2].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumns;
  if (extraConfig) {
    table[SQLiteTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return table;
}
var InlineForeignKeys2, SQLiteTable, sqliteTable;
var init_table3 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/table.js"() {
    init_entity();
    init_table();
    init_all();
    InlineForeignKeys2 = /* @__PURE__ */ Symbol.for("drizzle:SQLiteInlineForeignKeys");
    SQLiteTable = class extends Table {
      static {
        __name(this, "SQLiteTable");
      }
      static [entityKind] = "SQLiteTable";
      /** @internal */
      static Symbol = Object.assign({}, Table.Symbol, {
        InlineForeignKeys: InlineForeignKeys2
      });
      /** @internal */
      [Table.Symbol.Columns];
      /** @internal */
      [InlineForeignKeys2] = [];
      /** @internal */
      [Table.Symbol.ExtraConfigBuilder] = void 0;
    };
    __name(sqliteTableBase, "sqliteTableBase");
    sqliteTable = /* @__PURE__ */ __name((name, columns, extraConfig) => {
      return sqliteTableBase(name, columns, extraConfig);
    }, "sqliteTable");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/checks.js
var CheckBuilder, Check;
var init_checks = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/checks.js"() {
    init_entity();
    CheckBuilder = class {
      static {
        __name(this, "CheckBuilder");
      }
      constructor(name, value) {
        this.name = name;
        this.value = value;
      }
      static [entityKind] = "SQLiteCheckBuilder";
      brand;
      build(table) {
        return new Check(table, this);
      }
    };
    Check = class {
      static {
        __name(this, "Check");
      }
      constructor(table, builder) {
        this.table = table;
        this.name = builder.name;
        this.value = builder.value;
      }
      static [entityKind] = "SQLiteCheck";
      name;
      value;
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/indexes.js
function index(name) {
  return new IndexBuilderOn(name, false);
}
function uniqueIndex(name) {
  return new IndexBuilderOn(name, true);
}
var IndexBuilderOn, IndexBuilder, Index;
var init_indexes = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/indexes.js"() {
    init_entity();
    IndexBuilderOn = class {
      static {
        __name(this, "IndexBuilderOn");
      }
      constructor(name, unique) {
        this.name = name;
        this.unique = unique;
      }
      static [entityKind] = "SQLiteIndexBuilderOn";
      on(...columns) {
        return new IndexBuilder(this.name, columns, this.unique);
      }
    };
    IndexBuilder = class {
      static {
        __name(this, "IndexBuilder");
      }
      static [entityKind] = "SQLiteIndexBuilder";
      /** @internal */
      config;
      constructor(name, columns, unique) {
        this.config = {
          name,
          columns,
          unique,
          where: void 0
        };
      }
      /**
       * Condition for partial index.
       */
      where(condition) {
        this.config.where = condition;
        return this;
      }
      /** @internal */
      build(table) {
        return new Index(this.config, table);
      }
    };
    Index = class {
      static {
        __name(this, "Index");
      }
      static [entityKind] = "SQLiteIndex";
      config;
      constructor(config, table) {
        this.config = { ...config, table };
      }
    };
    __name(index, "index");
    __name(uniqueIndex, "uniqueIndex");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/primary-keys.js
var PrimaryKeyBuilder2, PrimaryKey2;
var init_primary_keys2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/primary-keys.js"() {
    init_entity();
    init_table3();
    PrimaryKeyBuilder2 = class {
      static {
        __name(this, "PrimaryKeyBuilder");
      }
      static [entityKind] = "SQLitePrimaryKeyBuilder";
      /** @internal */
      columns;
      /** @internal */
      name;
      constructor(columns, name) {
        this.columns = columns;
        this.name = name;
      }
      /** @internal */
      build(table) {
        return new PrimaryKey2(table, this.columns, this.name);
      }
    };
    PrimaryKey2 = class {
      static {
        __name(this, "PrimaryKey");
      }
      constructor(table, columns, name) {
        this.table = table;
        this.columns = columns;
        this.name = name;
      }
      static [entityKind] = "SQLitePrimaryKey";
      columns;
      name;
      getName() {
        return this.name ?? `${this.table[SQLiteTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/utils.js
function extractUsedTable(table) {
  if (is(table, SQLiteTable)) {
    return [`${table[Table.Symbol.BaseName]}`];
  }
  if (is(table, Subquery)) {
    return table._.usedTables ?? [];
  }
  if (is(table, SQL)) {
    return table.usedTables ?? [];
  }
  return [];
}
var init_utils2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/utils.js"() {
    init_entity();
    init_sql();
    init_subquery();
    init_table();
    init_table3();
    __name(extractUsedTable, "extractUsedTable");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/delete.js
var SQLiteDeleteBase;
var init_delete = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/delete.js"() {
    init_entity();
    init_query_promise();
    init_selection_proxy();
    init_table3();
    init_table();
    init_utils();
    init_utils2();
    SQLiteDeleteBase = class extends QueryPromise {
      static {
        __name(this, "SQLiteDeleteBase");
      }
      constructor(table, session, dialect, withList) {
        super();
        this.table = table;
        this.session = session;
        this.dialect = dialect;
        this.config = { table, withList };
      }
      static [entityKind] = "SQLiteDelete";
      /** @internal */
      config;
      /**
       * Adds a `where` clause to the query.
       *
       * Calling this method will delete only those rows that fulfill a specified condition.
       *
       * See docs: {@link https://orm.drizzle.team/docs/delete}
       *
       * @param where the `where` clause.
       *
       * @example
       * You can use conditional operators and `sql function` to filter the rows to be deleted.
       *
       * ```ts
       * // Delete all cars with green color
       * db.delete(cars).where(eq(cars.color, 'green'));
       * // or
       * db.delete(cars).where(sql`${cars.color} = 'green'`)
       * ```
       *
       * You can logically combine conditional operators with `and()` and `or()` operators:
       *
       * ```ts
       * // Delete all BMW cars with a green color
       * db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
       *
       * // Delete all cars with the green or blue color
       * db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
       * ```
       */
      where(where) {
        this.config.where = where;
        return this;
      }
      orderBy(...columns) {
        if (typeof columns[0] === "function") {
          const orderBy = columns[0](
            new Proxy(
              this.config.table[Table.Symbol.Columns],
              new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
            )
          );
          const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
          this.config.orderBy = orderByArray;
        } else {
          const orderByArray = columns;
          this.config.orderBy = orderByArray;
        }
        return this;
      }
      limit(limit) {
        this.config.limit = limit;
        return this;
      }
      returning(fields = this.table[SQLiteTable.Symbol.Columns]) {
        this.config.returning = orderSelectedFields(fields);
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildDeleteQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      /** @internal */
      _prepare(isOneTimeQuery = true) {
        return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
          this.dialect.sqlToQuery(this.getSQL()),
          this.config.returning,
          this.config.returning ? "all" : "run",
          true,
          void 0,
          {
            type: "delete",
            tables: extractUsedTable(this.config.table)
          }
        );
      }
      prepare() {
        return this._prepare(false);
      }
      run = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().run(placeholderValues);
      }, "run");
      all = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().all(placeholderValues);
      }, "all");
      get = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().get(placeholderValues);
      }, "get");
      values = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().values(placeholderValues);
      }, "values");
      async execute(placeholderValues) {
        return this._prepare().execute(placeholderValues);
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/casing.js
function toSnakeCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.reduce((acc, word, i) => {
    const formattedWord = i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
    return acc + formattedWord;
  }, "");
}
function noopCase(input) {
  return input;
}
var CasingCache;
var init_casing = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/casing.js"() {
    init_entity();
    init_table();
    __name(toSnakeCase, "toSnakeCase");
    __name(toCamelCase, "toCamelCase");
    __name(noopCase, "noopCase");
    CasingCache = class {
      static {
        __name(this, "CasingCache");
      }
      static [entityKind] = "CasingCache";
      /** @internal */
      cache = {};
      cachedTables = {};
      convert;
      constructor(casing) {
        this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
      }
      getColumnCasing(column) {
        if (!column.keyAsName) return column.name;
        const schema = column.table[Table.Symbol.Schema] ?? "public";
        const tableName = column.table[Table.Symbol.OriginalName];
        const key = `${schema}.${tableName}.${column.name}`;
        if (!this.cache[key]) {
          this.cacheTable(column.table);
        }
        return this.cache[key];
      }
      cacheTable(table) {
        const schema = table[Table.Symbol.Schema] ?? "public";
        const tableName = table[Table.Symbol.OriginalName];
        const tableKey = `${schema}.${tableName}`;
        if (!this.cachedTables[tableKey]) {
          for (const column of Object.values(table[Table.Symbol.Columns])) {
            const columnKey = `${tableKey}.${column.name}`;
            this.cache[columnKey] = this.convert(column.name);
          }
          this.cachedTables[tableKey] = true;
        }
      }
      clearCache() {
        this.cache = {};
        this.cachedTables = {};
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/errors.js
var DrizzleError, DrizzleQueryError, TransactionRollbackError;
var init_errors = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/errors.js"() {
    init_entity();
    DrizzleError = class extends Error {
      static {
        __name(this, "DrizzleError");
      }
      static [entityKind] = "DrizzleError";
      constructor({ message, cause }) {
        super(message);
        this.name = "DrizzleError";
        this.cause = cause;
      }
    };
    DrizzleQueryError = class _DrizzleQueryError extends Error {
      static {
        __name(this, "DrizzleQueryError");
      }
      constructor(query, params, cause) {
        super(`Failed query: ${query}
params: ${params}`);
        this.query = query;
        this.params = params;
        this.cause = cause;
        Error.captureStackTrace(this, _DrizzleQueryError);
        if (cause) this.cause = cause;
      }
    };
    TransactionRollbackError = class extends DrizzleError {
      static {
        __name(this, "TransactionRollbackError");
      }
      static [entityKind] = "TransactionRollbackError";
      constructor() {
        super({ message: "Rollback" });
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/functions/aggregate.js
var init_aggregate = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/functions/aggregate.js"() {
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/functions/vector.js
var init_vector = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/functions/vector.js"() {
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/functions/index.js
var init_functions = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/functions/index.js"() {
    init_aggregate();
    init_vector();
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/index.js
var init_sql2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sql/index.js"() {
    init_expressions();
    init_functions();
    init_sql();
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/index.js
var init_columns = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/columns/index.js"() {
    init_blob();
    init_common2();
    init_custom();
    init_integer();
    init_numeric();
    init_real();
    init_text();
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/view-base.js
var SQLiteViewBase;
var init_view_base = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/view-base.js"() {
    init_entity();
    init_sql();
    SQLiteViewBase = class extends View {
      static {
        __name(this, "SQLiteViewBase");
      }
      static [entityKind] = "SQLiteViewBase";
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/dialect.js
var SQLiteDialect, SQLiteSyncDialect, SQLiteAsyncDialect;
var init_dialect = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/dialect.js"() {
    init_alias();
    init_casing();
    init_column();
    init_entity();
    init_errors();
    init_relations();
    init_sql2();
    init_sql();
    init_columns();
    init_table3();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
    init_view_base();
    SQLiteDialect = class {
      static {
        __name(this, "SQLiteDialect");
      }
      static [entityKind] = "SQLiteDialect";
      /** @internal */
      casing;
      constructor(config) {
        this.casing = new CasingCache(config?.casing);
      }
      escapeName(name) {
        return `"${name.replace(/"/g, '""')}"`;
      }
      escapeParam(_num) {
        return "?";
      }
      escapeString(str) {
        return `'${str.replace(/'/g, "''")}'`;
      }
      buildWithCTE(queries) {
        if (!queries?.length) return void 0;
        const withSqlChunks = [sql`with `];
        for (const [i, w] of queries.entries()) {
          withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
          if (i < queries.length - 1) {
            withSqlChunks.push(sql`, `);
          }
        }
        withSqlChunks.push(sql` `);
        return sql.join(withSqlChunks);
      }
      buildDeleteQuery({
        table,
        where,
        returning,
        withList,
        limit,
        orderBy
      }) {
        const withSql = this.buildWithCTE(withList);
        const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
        const whereSql = where ? sql` where ${where}` : void 0;
        const orderBySql = this.buildOrderBy(orderBy);
        const limitSql = this.buildLimit(limit);
        return sql`${withSql}delete from ${table}${whereSql}${returningSql}${orderBySql}${limitSql}`;
      }
      buildUpdateSet(table, set) {
        const tableColumns = table[Table.Symbol.Columns];
        const columnNames = Object.keys(tableColumns).filter(
          (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
        );
        const setSize = columnNames.length;
        return sql.join(
          columnNames.flatMap((colName, i) => {
            const col = tableColumns[colName];
            const onUpdateFnResult = col.onUpdateFn?.();
            const value = set[colName] ?? (is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col));
            const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
            if (i < setSize - 1) {
              return [res, sql.raw(", ")];
            }
            return [res];
          })
        );
      }
      buildUpdateQuery({
        table,
        set,
        where,
        returning,
        withList,
        joins,
        from,
        limit,
        orderBy
      }) {
        const withSql = this.buildWithCTE(withList);
        const setSql = this.buildUpdateSet(table, set);
        const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
        const joinsSql = this.buildJoins(joins);
        const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
        const whereSql = where ? sql` where ${where}` : void 0;
        const orderBySql = this.buildOrderBy(orderBy);
        const limitSql = this.buildLimit(limit);
        return sql`${withSql}update ${table} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}${orderBySql}${limitSql}`;
      }
      /**
       * Builds selection SQL with provided fields/expressions
       *
       * Examples:
       *
       * `select <selection> from`
       *
       * `insert ... returning <selection>`
       *
       * If `isSingleTable` is true, then columns won't be prefixed with table name
       */
      buildSelection(fields, { isSingleTable = false } = {}) {
        const columnsLen = fields.length;
        const chunks = fields.flatMap(({ field }, i) => {
          const chunk = [];
          if (is(field, SQL.Aliased) && field.isSelectionField) {
            chunk.push(sql.identifier(field.fieldAlias));
          } else if (is(field, SQL.Aliased) || is(field, SQL)) {
            const query = is(field, SQL.Aliased) ? field.sql : field;
            if (isSingleTable) {
              chunk.push(
                new SQL(
                  query.queryChunks.map((c) => {
                    if (is(c, Column)) {
                      return sql.identifier(this.casing.getColumnCasing(c));
                    }
                    return c;
                  })
                )
              );
            } else {
              chunk.push(query);
            }
            if (is(field, SQL.Aliased)) {
              chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
            }
          } else if (is(field, Column)) {
            const tableName = field.table[Table.Symbol.Name];
            if (field.columnType === "SQLiteNumericBigInt") {
              if (isSingleTable) {
                chunk.push(
                  sql`cast(${sql.identifier(this.casing.getColumnCasing(field))} as text)`
                );
              } else {
                chunk.push(
                  sql`cast(${sql.identifier(tableName)}.${sql.identifier(this.casing.getColumnCasing(field))} as text)`
                );
              }
            } else {
              if (isSingleTable) {
                chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
              } else {
                chunk.push(
                  sql`${sql.identifier(tableName)}.${sql.identifier(this.casing.getColumnCasing(field))}`
                );
              }
            }
          } else if (is(field, Subquery)) {
            const entries = Object.entries(field._.selectedFields);
            if (entries.length === 1) {
              const entry = entries[0][1];
              const fieldDecoder = is(entry, SQL) ? entry.decoder : is(entry, Column) ? { mapFromDriverValue: /* @__PURE__ */ __name((v) => entry.mapFromDriverValue(v), "mapFromDriverValue") } : entry.sql.decoder;
              if (fieldDecoder) field._.sql.decoder = fieldDecoder;
            }
            chunk.push(field);
          }
          if (i < columnsLen - 1) {
            chunk.push(sql`, `);
          }
          return chunk;
        });
        return sql.join(chunks);
      }
      buildJoins(joins) {
        if (!joins || joins.length === 0) {
          return void 0;
        }
        const joinsArray = [];
        if (joins) {
          for (const [index2, joinMeta] of joins.entries()) {
            if (index2 === 0) {
              joinsArray.push(sql` `);
            }
            const table = joinMeta.table;
            const onSql = joinMeta.on ? sql` on ${joinMeta.on}` : void 0;
            if (is(table, SQLiteTable)) {
              const tableName = table[SQLiteTable.Symbol.Name];
              const tableSchema = table[SQLiteTable.Symbol.Schema];
              const origTableName = table[SQLiteTable.Symbol.OriginalName];
              const alias = tableName === origTableName ? void 0 : joinMeta.alias;
              joinsArray.push(
                sql`${sql.raw(joinMeta.joinType)} join ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(
                  origTableName
                )}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
              );
            } else {
              joinsArray.push(
                sql`${sql.raw(joinMeta.joinType)} join ${table}${onSql}`
              );
            }
            if (index2 < joins.length - 1) {
              joinsArray.push(sql` `);
            }
          }
        }
        return sql.join(joinsArray);
      }
      buildLimit(limit) {
        return typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
      }
      buildOrderBy(orderBy) {
        const orderByList = [];
        if (orderBy) {
          for (const [index2, orderByValue] of orderBy.entries()) {
            orderByList.push(orderByValue);
            if (index2 < orderBy.length - 1) {
              orderByList.push(sql`, `);
            }
          }
        }
        return orderByList.length > 0 ? sql` order by ${sql.join(orderByList)}` : void 0;
      }
      buildFromTable(table) {
        if (is(table, Table) && table[Table.Symbol.IsAlias]) {
          return sql`${sql`${sql.identifier(table[Table.Symbol.Schema] ?? "")}.`.if(table[Table.Symbol.Schema])}${sql.identifier(
            table[Table.Symbol.OriginalName]
          )} ${sql.identifier(table[Table.Symbol.Name])}`;
        }
        return table;
      }
      buildSelectQuery({
        withList,
        fields,
        fieldsFlat,
        where,
        having,
        table,
        joins,
        orderBy,
        groupBy,
        limit,
        offset,
        distinct,
        setOperators
      }) {
        const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
        for (const f of fieldsList) {
          if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, SQLiteViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
            ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
          ))(f.field.table)) {
            const tableName = getTableName(f.field.table);
            throw new Error(
              `Your "${f.path.join(
                "->"
              )}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
            );
          }
        }
        const isSingleTable = !joins || joins.length === 0;
        const withSql = this.buildWithCTE(withList);
        const distinctSql = distinct ? sql` distinct` : void 0;
        const selection = this.buildSelection(fieldsList, { isSingleTable });
        const tableSql = this.buildFromTable(table);
        const joinsSql = this.buildJoins(joins);
        const whereSql = where ? sql` where ${where}` : void 0;
        const havingSql = having ? sql` having ${having}` : void 0;
        const groupByList = [];
        if (groupBy) {
          for (const [index2, groupByValue] of groupBy.entries()) {
            groupByList.push(groupByValue);
            if (index2 < groupBy.length - 1) {
              groupByList.push(sql`, `);
            }
          }
        }
        const groupBySql = groupByList.length > 0 ? sql` group by ${sql.join(groupByList)}` : void 0;
        const orderBySql = this.buildOrderBy(orderBy);
        const limitSql = this.buildLimit(limit);
        const offsetSql = offset ? sql` offset ${offset}` : void 0;
        const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}`;
        if (setOperators.length > 0) {
          return this.buildSetOperations(finalQuery, setOperators);
        }
        return finalQuery;
      }
      buildSetOperations(leftSelect, setOperators) {
        const [setOperator, ...rest] = setOperators;
        if (!setOperator) {
          throw new Error("Cannot pass undefined values to any set operator");
        }
        if (rest.length === 0) {
          return this.buildSetOperationQuery({ leftSelect, setOperator });
        }
        return this.buildSetOperations(
          this.buildSetOperationQuery({ leftSelect, setOperator }),
          rest
        );
      }
      buildSetOperationQuery({
        leftSelect,
        setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
      }) {
        const leftChunk = sql`${leftSelect.getSQL()} `;
        const rightChunk = sql`${rightSelect.getSQL()}`;
        let orderBySql;
        if (orderBy && orderBy.length > 0) {
          const orderByValues = [];
          for (const singleOrderBy of orderBy) {
            if (is(singleOrderBy, SQLiteColumn)) {
              orderByValues.push(sql.identifier(singleOrderBy.name));
            } else if (is(singleOrderBy, SQL)) {
              for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
                const chunk = singleOrderBy.queryChunks[i];
                if (is(chunk, SQLiteColumn)) {
                  singleOrderBy.queryChunks[i] = sql.identifier(
                    this.casing.getColumnCasing(chunk)
                  );
                }
              }
              orderByValues.push(sql`${singleOrderBy}`);
            } else {
              orderByValues.push(sql`${singleOrderBy}`);
            }
          }
          orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)}`;
        }
        const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
        const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
        const offsetSql = offset ? sql` offset ${offset}` : void 0;
        return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
      }
      buildInsertQuery({
        table,
        values: valuesOrSelect,
        onConflict,
        returning,
        withList,
        select
      }) {
        const valuesSqlList = [];
        const columns = table[Table.Symbol.Columns];
        const colEntries = Object.entries(columns).filter(
          ([_, col]) => !col.shouldDisableInsert()
        );
        const insertOrder = colEntries.map(([, column]) => sql.identifier(this.casing.getColumnCasing(column)));
        if (select) {
          const select2 = valuesOrSelect;
          if (is(select2, SQL)) {
            valuesSqlList.push(select2);
          } else {
            valuesSqlList.push(select2.getSQL());
          }
        } else {
          const values = valuesOrSelect;
          valuesSqlList.push(sql.raw("values "));
          for (const [valueIndex, value] of values.entries()) {
            const valueList = [];
            for (const [fieldName, col] of colEntries) {
              const colValue = value[fieldName];
              if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
                let defaultValue;
                if (col.default !== null && col.default !== void 0) {
                  defaultValue = is(col.default, SQL) ? col.default : sql.param(col.default, col);
                } else if (col.defaultFn !== void 0) {
                  const defaultFnResult = col.defaultFn();
                  defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
                } else if (!col.default && col.onUpdateFn !== void 0) {
                  const onUpdateFnResult = col.onUpdateFn();
                  defaultValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
                } else {
                  defaultValue = sql`null`;
                }
                valueList.push(defaultValue);
              } else {
                valueList.push(colValue);
              }
            }
            valuesSqlList.push(valueList);
            if (valueIndex < values.length - 1) {
              valuesSqlList.push(sql`, `);
            }
          }
        }
        const withSql = this.buildWithCTE(withList);
        const valuesSql = sql.join(valuesSqlList);
        const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
        const onConflictSql = onConflict?.length ? sql.join(onConflict) : void 0;
        return sql`${withSql}insert into ${table} ${insertOrder} ${valuesSql}${onConflictSql}${returningSql}`;
      }
      sqlToQuery(sql22, invokeSource) {
        return sql22.toQuery({
          casing: this.casing,
          escapeName: this.escapeName,
          escapeParam: this.escapeParam,
          escapeString: this.escapeString,
          invokeSource
        });
      }
      buildRelationalQuery({
        fullSchema,
        schema,
        tableNamesMap,
        table,
        tableConfig,
        queryConfig: config,
        tableAlias,
        nestedQueryRelation,
        joinOn
      }) {
        let selection = [];
        let limit, offset, orderBy = [], where;
        const joins = [];
        if (config === true) {
          const selectionEntries = Object.entries(tableConfig.columns);
          selection = selectionEntries.map(([key, value]) => ({
            dbKey: value.name,
            tsKey: key,
            field: aliasedTableColumn(value, tableAlias),
            relationTableTsKey: void 0,
            isJson: false,
            selection: []
          }));
        } else {
          const aliasedColumns = Object.fromEntries(
            Object.entries(tableConfig.columns).map(([key, value]) => [
              key,
              aliasedTableColumn(value, tableAlias)
            ])
          );
          if (config.where) {
            const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
            where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
          }
          const fieldsSelection = [];
          let selectedColumns = [];
          if (config.columns) {
            let isIncludeMode = false;
            for (const [field, value] of Object.entries(config.columns)) {
              if (value === void 0) {
                continue;
              }
              if (field in tableConfig.columns) {
                if (!isIncludeMode && value === true) {
                  isIncludeMode = true;
                }
                selectedColumns.push(field);
              }
            }
            if (selectedColumns.length > 0) {
              selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter(
                (key) => !selectedColumns.includes(key)
              );
            }
          } else {
            selectedColumns = Object.keys(tableConfig.columns);
          }
          for (const field of selectedColumns) {
            const column = tableConfig.columns[field];
            fieldsSelection.push({ tsKey: field, value: column });
          }
          let selectedRelations = [];
          if (config.with) {
            selectedRelations = Object.entries(config.with).filter(
              (entry) => !!entry[1]
            ).map(([tsKey, queryConfig]) => ({
              tsKey,
              queryConfig,
              relation: tableConfig.relations[tsKey]
            }));
          }
          let extras;
          if (config.extras) {
            extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
            for (const [tsKey, value] of Object.entries(extras)) {
              fieldsSelection.push({
                tsKey,
                value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
              });
            }
          }
          for (const { tsKey, value } of fieldsSelection) {
            selection.push({
              dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
              tsKey,
              field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
              relationTableTsKey: void 0,
              isJson: false,
              selection: []
            });
          }
          let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
          if (!Array.isArray(orderByOrig)) {
            orderByOrig = [orderByOrig];
          }
          orderBy = orderByOrig.map((orderByValue) => {
            if (is(orderByValue, Column)) {
              return aliasedTableColumn(orderByValue, tableAlias);
            }
            return mapColumnsInSQLToAlias(orderByValue, tableAlias);
          });
          limit = config.limit;
          offset = config.offset;
          for (const {
            tsKey: selectedRelationTsKey,
            queryConfig: selectedRelationConfigValue,
            relation
          } of selectedRelations) {
            const normalizedRelation = normalizeRelation(
              schema,
              tableNamesMap,
              relation
            );
            const relationTableName = getTableUniqueName(relation.referencedTable);
            const relationTableTsName = tableNamesMap[relationTableName];
            const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
            const joinOn2 = and(
              ...normalizedRelation.fields.map(
                (field2, i) => eq(
                  aliasedTableColumn(
                    normalizedRelation.references[i],
                    relationTableAlias
                  ),
                  aliasedTableColumn(field2, tableAlias)
                )
              )
            );
            const builtRelation = this.buildRelationalQuery({
              fullSchema,
              schema,
              tableNamesMap,
              table: fullSchema[relationTableTsName],
              tableConfig: schema[relationTableTsName],
              queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
              tableAlias: relationTableAlias,
              joinOn: joinOn2,
              nestedQueryRelation: relation
            });
            const field = sql`(${builtRelation.sql})`.as(selectedRelationTsKey);
            selection.push({
              dbKey: selectedRelationTsKey,
              tsKey: selectedRelationTsKey,
              field,
              relationTableTsKey: relationTableTsName,
              isJson: true,
              selection: builtRelation.selection
            });
          }
        }
        if (selection.length === 0) {
          throw new DrizzleError({
            message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}"). You need to have at least one item in "columns", "with" or "extras". If you need to select all columns, omit the "columns" key or set it to undefined.`
          });
        }
        let result;
        where = and(joinOn, where);
        if (nestedQueryRelation) {
          let field = sql`json_array(${sql.join(
            selection.map(
              ({ field: field2 }) => is(field2, SQLiteColumn) ? sql.identifier(this.casing.getColumnCasing(field2)) : is(field2, SQL.Aliased) ? field2.sql : field2
            ),
            sql`, `
          )})`;
          if (is(nestedQueryRelation, Many)) {
            field = sql`coalesce(json_group_array(${field}), json_array())`;
          }
          const nestedSelection = [
            {
              dbKey: "data",
              tsKey: "data",
              field: field.as("data"),
              isJson: true,
              relationTableTsKey: tableConfig.tsName,
              selection
            }
          ];
          const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
          if (needsSubquery) {
            result = this.buildSelectQuery({
              table: aliasedTable(table, tableAlias),
              fields: {},
              fieldsFlat: [
                {
                  path: [],
                  field: sql.raw("*")
                }
              ],
              where,
              limit,
              offset,
              orderBy,
              setOperators: []
            });
            where = void 0;
            limit = void 0;
            offset = void 0;
            orderBy = void 0;
          } else {
            result = aliasedTable(table, tableAlias);
          }
          result = this.buildSelectQuery({
            table: is(result, SQLiteTable) ? result : new Subquery(result, {}, tableAlias),
            fields: {},
            fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
              path: [],
              field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
            })),
            joins,
            where,
            limit,
            offset,
            orderBy,
            setOperators: []
          });
        } else {
          result = this.buildSelectQuery({
            table: aliasedTable(table, tableAlias),
            fields: {},
            fieldsFlat: selection.map(({ field }) => ({
              path: [],
              field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
            })),
            joins,
            where,
            limit,
            offset,
            orderBy,
            setOperators: []
          });
        }
        return {
          tableTsKey: tableConfig.tsName,
          sql: result,
          selection
        };
      }
    };
    SQLiteSyncDialect = class extends SQLiteDialect {
      static {
        __name(this, "SQLiteSyncDialect");
      }
      static [entityKind] = "SQLiteSyncDialect";
      migrate(migrations, session, config) {
        const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
        const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
        session.run(migrationTableCreate);
        const dbMigrations = session.values(
          sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
        );
        const lastDbMigration = dbMigrations[0] ?? void 0;
        session.run(sql`BEGIN`);
        try {
          for (const migration of migrations) {
            if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
              for (const stmt of migration.sql) {
                session.run(sql.raw(stmt));
              }
              session.run(
                sql`INSERT INTO ${sql.identifier(
                  migrationsTable
                )} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
              );
            }
          }
          session.run(sql`COMMIT`);
        } catch (e) {
          session.run(sql`ROLLBACK`);
          throw e;
        }
      }
    };
    SQLiteAsyncDialect = class extends SQLiteDialect {
      static {
        __name(this, "SQLiteAsyncDialect");
      }
      static [entityKind] = "SQLiteAsyncDialect";
      async migrate(migrations, session, config) {
        const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
        const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
        await session.run(migrationTableCreate);
        const dbMigrations = await session.values(
          sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
        );
        const lastDbMigration = dbMigrations[0] ?? void 0;
        await session.transaction(async (tx) => {
          for (const migration of migrations) {
            if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
              for (const stmt of migration.sql) {
                await tx.run(sql.raw(stmt));
              }
              await tx.run(
                sql`INSERT INTO ${sql.identifier(
                  migrationsTable
                )} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
              );
            }
          }
        });
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder;
var init_query_builder = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/query-builders/query-builder.js"() {
    init_entity();
    TypedQueryBuilder = class {
      static {
        __name(this, "TypedQueryBuilder");
      }
      static [entityKind] = "TypedQueryBuilder";
      /** @internal */
      getSelectedFields() {
        return this._.selectedFields;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/select.js
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select) => ({
      type,
      isAll,
      rightSelect: select
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
var SQLiteSelectBuilder, SQLiteSelectQueryBuilderBase, SQLiteSelectBase, getSQLiteSetOperators, union, unionAll, intersect, except;
var init_select2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/select.js"() {
    init_entity();
    init_query_builder();
    init_query_promise();
    init_selection_proxy();
    init_sql();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
    init_utils2();
    init_view_base();
    SQLiteSelectBuilder = class {
      static {
        __name(this, "SQLiteSelectBuilder");
      }
      static [entityKind] = "SQLiteSelectBuilder";
      fields;
      session;
      dialect;
      withList;
      distinct;
      constructor(config) {
        this.fields = config.fields;
        this.session = config.session;
        this.dialect = config.dialect;
        this.withList = config.withList;
        this.distinct = config.distinct;
      }
      from(source) {
        const isPartialSelect = !!this.fields;
        let fields;
        if (this.fields) {
          fields = this.fields;
        } else if (is(source, Subquery)) {
          fields = Object.fromEntries(
            Object.keys(source._.selectedFields).map((key) => [key, source[key]])
          );
        } else if (is(source, SQLiteViewBase)) {
          fields = source[ViewBaseConfig].selectedFields;
        } else if (is(source, SQL)) {
          fields = {};
        } else {
          fields = getTableColumns(source);
        }
        return new SQLiteSelectBase({
          table: source,
          fields,
          isPartialSelect,
          session: this.session,
          dialect: this.dialect,
          withList: this.withList,
          distinct: this.distinct
        });
      }
    };
    SQLiteSelectQueryBuilderBase = class extends TypedQueryBuilder {
      static {
        __name(this, "SQLiteSelectQueryBuilderBase");
      }
      static [entityKind] = "SQLiteSelectQueryBuilder";
      _;
      /** @internal */
      config;
      joinsNotNullableMap;
      tableName;
      isPartialSelect;
      session;
      dialect;
      cacheConfig = void 0;
      usedTables = /* @__PURE__ */ new Set();
      constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
        super();
        this.config = {
          withList,
          table,
          fields: { ...fields },
          distinct,
          setOperators: []
        };
        this.isPartialSelect = isPartialSelect;
        this.session = session;
        this.dialect = dialect;
        this._ = {
          selectedFields: fields,
          config: this.config
        };
        this.tableName = getTableLikeName(table);
        this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
        for (const item of extractUsedTable(table)) this.usedTables.add(item);
      }
      /** @internal */
      getUsedTables() {
        return [...this.usedTables];
      }
      createJoin(joinType) {
        return (table, on) => {
          const baseTableName = this.tableName;
          const tableName = getTableLikeName(table);
          for (const item of extractUsedTable(table)) this.usedTables.add(item);
          if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
            throw new Error(`Alias "${tableName}" is already used in this query`);
          }
          if (!this.isPartialSelect) {
            if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
              this.config.fields = {
                [baseTableName]: this.config.fields
              };
            }
            if (typeof tableName === "string" && !is(table, SQL)) {
              const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
              this.config.fields[tableName] = selection;
            }
          }
          if (typeof on === "function") {
            on = on(
              new Proxy(
                this.config.fields,
                new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
              )
            );
          }
          if (!this.config.joins) {
            this.config.joins = [];
          }
          this.config.joins.push({ on, table, joinType, alias: tableName });
          if (typeof tableName === "string") {
            switch (joinType) {
              case "left": {
                this.joinsNotNullableMap[tableName] = false;
                break;
              }
              case "right": {
                this.joinsNotNullableMap = Object.fromEntries(
                  Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
                );
                this.joinsNotNullableMap[tableName] = true;
                break;
              }
              case "cross":
              case "inner": {
                this.joinsNotNullableMap[tableName] = true;
                break;
              }
              case "full": {
                this.joinsNotNullableMap = Object.fromEntries(
                  Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
                );
                this.joinsNotNullableMap[tableName] = false;
                break;
              }
            }
          }
          return this;
        };
      }
      /**
       * Executes a `left join` operation by adding another table to the current query.
       *
       * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
       *
       * @param table the table to join.
       * @param on the `on` clause.
       *
       * @example
       *
       * ```ts
       * // Select all users and their pets
       * const usersWithPets: { user: User; pets: Pet | null; }[] = await db.select()
       *   .from(users)
       *   .leftJoin(pets, eq(users.id, pets.ownerId))
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number; petId: number | null; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .leftJoin(pets, eq(users.id, pets.ownerId))
       * ```
       */
      leftJoin = this.createJoin("left");
      /**
       * Executes a `right join` operation by adding another table to the current query.
       *
       * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
       *
       * @param table the table to join.
       * @param on the `on` clause.
       *
       * @example
       *
       * ```ts
       * // Select all users and their pets
       * const usersWithPets: { user: User | null; pets: Pet; }[] = await db.select()
       *   .from(users)
       *   .rightJoin(pets, eq(users.id, pets.ownerId))
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number | null; petId: number; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .rightJoin(pets, eq(users.id, pets.ownerId))
       * ```
       */
      rightJoin = this.createJoin("right");
      /**
       * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
       *
       * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
       *
       * @param table the table to join.
       * @param on the `on` clause.
       *
       * @example
       *
       * ```ts
       * // Select all users and their pets
       * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
       *   .from(users)
       *   .innerJoin(pets, eq(users.id, pets.ownerId))
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .innerJoin(pets, eq(users.id, pets.ownerId))
       * ```
       */
      innerJoin = this.createJoin("inner");
      /**
       * Executes a `full join` operation by combining rows from two tables into a new table.
       *
       * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
       *
       * @param table the table to join.
       * @param on the `on` clause.
       *
       * @example
       *
       * ```ts
       * // Select all users and their pets
       * const usersWithPets: { user: User | null; pets: Pet | null; }[] = await db.select()
       *   .from(users)
       *   .fullJoin(pets, eq(users.id, pets.ownerId))
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number | null; petId: number | null; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .fullJoin(pets, eq(users.id, pets.ownerId))
       * ```
       */
      fullJoin = this.createJoin("full");
      /**
       * Executes a `cross join` operation by combining rows from two tables into a new table.
       *
       * Calling this method retrieves all rows from both main and joined tables, merging all rows from each table.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join}
       *
       * @param table the table to join.
       *
       * @example
       *
       * ```ts
       * // Select all users, each user with every pet
       * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
       *   .from(users)
       *   .crossJoin(pets)
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .crossJoin(pets)
       * ```
       */
      crossJoin = this.createJoin("cross");
      createSetOperator(type, isAll) {
        return (rightSelection) => {
          const rightSelect = typeof rightSelection === "function" ? rightSelection(getSQLiteSetOperators()) : rightSelection;
          if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
            throw new Error(
              "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
            );
          }
          this.config.setOperators.push({ type, isAll, rightSelect });
          return this;
        };
      }
      /**
       * Adds `union` set operator to the query.
       *
       * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
       *
       * @example
       *
       * ```ts
       * // Select all unique names from customers and users tables
       * await db.select({ name: users.name })
       *   .from(users)
       *   .union(
       *     db.select({ name: customers.name }).from(customers)
       *   );
       * // or
       * import { union } from 'drizzle-orm/sqlite-core'
       *
       * await union(
       *   db.select({ name: users.name }).from(users),
       *   db.select({ name: customers.name }).from(customers)
       * );
       * ```
       */
      union = this.createSetOperator("union", false);
      /**
       * Adds `union all` set operator to the query.
       *
       * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
       *
       * @example
       *
       * ```ts
       * // Select all transaction ids from both online and in-store sales
       * await db.select({ transaction: onlineSales.transactionId })
       *   .from(onlineSales)
       *   .unionAll(
       *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
       *   );
       * // or
       * import { unionAll } from 'drizzle-orm/sqlite-core'
       *
       * await unionAll(
       *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
       *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
       * );
       * ```
       */
      unionAll = this.createSetOperator("union", true);
      /**
       * Adds `intersect` set operator to the query.
       *
       * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
       *
       * @example
       *
       * ```ts
       * // Select course names that are offered in both departments A and B
       * await db.select({ courseName: depA.courseName })
       *   .from(depA)
       *   .intersect(
       *     db.select({ courseName: depB.courseName }).from(depB)
       *   );
       * // or
       * import { intersect } from 'drizzle-orm/sqlite-core'
       *
       * await intersect(
       *   db.select({ courseName: depA.courseName }).from(depA),
       *   db.select({ courseName: depB.courseName }).from(depB)
       * );
       * ```
       */
      intersect = this.createSetOperator("intersect", false);
      /**
       * Adds `except` set operator to the query.
       *
       * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
       *
       * @example
       *
       * ```ts
       * // Select all courses offered in department A but not in department B
       * await db.select({ courseName: depA.courseName })
       *   .from(depA)
       *   .except(
       *     db.select({ courseName: depB.courseName }).from(depB)
       *   );
       * // or
       * import { except } from 'drizzle-orm/sqlite-core'
       *
       * await except(
       *   db.select({ courseName: depA.courseName }).from(depA),
       *   db.select({ courseName: depB.courseName }).from(depB)
       * );
       * ```
       */
      except = this.createSetOperator("except", false);
      /** @internal */
      addSetOperators(setOperators) {
        this.config.setOperators.push(...setOperators);
        return this;
      }
      /**
       * Adds a `where` clause to the query.
       *
       * Calling this method will select only those rows that fulfill a specified condition.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
       *
       * @param where the `where` clause.
       *
       * @example
       * You can use conditional operators and `sql function` to filter the rows to be selected.
       *
       * ```ts
       * // Select all cars with green color
       * await db.select().from(cars).where(eq(cars.color, 'green'));
       * // or
       * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
       * ```
       *
       * You can logically combine conditional operators with `and()` and `or()` operators:
       *
       * ```ts
       * // Select all BMW cars with a green color
       * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
       *
       * // Select all cars with the green or blue color
       * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
       * ```
       */
      where(where) {
        if (typeof where === "function") {
          where = where(
            new Proxy(
              this.config.fields,
              new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
            )
          );
        }
        this.config.where = where;
        return this;
      }
      /**
       * Adds a `having` clause to the query.
       *
       * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
       *
       * @param having the `having` clause.
       *
       * @example
       *
       * ```ts
       * // Select all brands with more than one car
       * await db.select({
       * 	brand: cars.brand,
       * 	count: sql<number>`cast(count(${cars.id}) as int)`,
       * })
       *   .from(cars)
       *   .groupBy(cars.brand)
       *   .having(({ count }) => gt(count, 1));
       * ```
       */
      having(having) {
        if (typeof having === "function") {
          having = having(
            new Proxy(
              this.config.fields,
              new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
            )
          );
        }
        this.config.having = having;
        return this;
      }
      groupBy(...columns) {
        if (typeof columns[0] === "function") {
          const groupBy = columns[0](
            new Proxy(
              this.config.fields,
              new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
            )
          );
          this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
        } else {
          this.config.groupBy = columns;
        }
        return this;
      }
      orderBy(...columns) {
        if (typeof columns[0] === "function") {
          const orderBy = columns[0](
            new Proxy(
              this.config.fields,
              new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
            )
          );
          const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
          if (this.config.setOperators.length > 0) {
            this.config.setOperators.at(-1).orderBy = orderByArray;
          } else {
            this.config.orderBy = orderByArray;
          }
        } else {
          const orderByArray = columns;
          if (this.config.setOperators.length > 0) {
            this.config.setOperators.at(-1).orderBy = orderByArray;
          } else {
            this.config.orderBy = orderByArray;
          }
        }
        return this;
      }
      /**
       * Adds a `limit` clause to the query.
       *
       * Calling this method will set the maximum number of rows that will be returned by this query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
       *
       * @param limit the `limit` clause.
       *
       * @example
       *
       * ```ts
       * // Get the first 10 people from this query.
       * await db.select().from(people).limit(10);
       * ```
       */
      limit(limit) {
        if (this.config.setOperators.length > 0) {
          this.config.setOperators.at(-1).limit = limit;
        } else {
          this.config.limit = limit;
        }
        return this;
      }
      /**
       * Adds an `offset` clause to the query.
       *
       * Calling this method will skip a number of rows when returning results from this query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
       *
       * @param offset the `offset` clause.
       *
       * @example
       *
       * ```ts
       * // Get the 10th-20th people from this query.
       * await db.select().from(people).offset(10).limit(10);
       * ```
       */
      offset(offset) {
        if (this.config.setOperators.length > 0) {
          this.config.setOperators.at(-1).offset = offset;
        } else {
          this.config.offset = offset;
        }
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildSelectQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      as(alias) {
        const usedTables = [];
        usedTables.push(...extractUsedTable(this.config.table));
        if (this.config.joins) {
          for (const it of this.config.joins) usedTables.push(...extractUsedTable(it.table));
        }
        return new Proxy(
          new Subquery(this.getSQL(), this.config.fields, alias, false, [...new Set(usedTables)]),
          new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      }
      /** @internal */
      getSelectedFields() {
        return new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      }
      $dynamic() {
        return this;
      }
    };
    SQLiteSelectBase = class extends SQLiteSelectQueryBuilderBase {
      static {
        __name(this, "SQLiteSelectBase");
      }
      static [entityKind] = "SQLiteSelect";
      /** @internal */
      _prepare(isOneTimeQuery = true) {
        if (!this.session) {
          throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
        }
        const fieldsList = orderSelectedFields(this.config.fields);
        const query = this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
          this.dialect.sqlToQuery(this.getSQL()),
          fieldsList,
          "all",
          true,
          void 0,
          {
            type: "select",
            tables: [...this.usedTables]
          },
          this.cacheConfig
        );
        query.joinsNotNullableMap = this.joinsNotNullableMap;
        return query;
      }
      $withCache(config) {
        this.cacheConfig = config === void 0 ? { config: {}, enable: true, autoInvalidate: true } : config === false ? { enable: false } : { enable: true, autoInvalidate: true, ...config };
        return this;
      }
      prepare() {
        return this._prepare(false);
      }
      run = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().run(placeholderValues);
      }, "run");
      all = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().all(placeholderValues);
      }, "all");
      get = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().get(placeholderValues);
      }, "get");
      values = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().values(placeholderValues);
      }, "values");
      async execute() {
        return this.all();
      }
    };
    applyMixins(SQLiteSelectBase, [QueryPromise]);
    __name(createSetOperator, "createSetOperator");
    getSQLiteSetOperators = /* @__PURE__ */ __name(() => ({
      union,
      unionAll,
      intersect,
      except
    }), "getSQLiteSetOperators");
    union = createSetOperator("union", false);
    unionAll = createSetOperator("union", true);
    intersect = createSetOperator("intersect", false);
    except = createSetOperator("except", false);
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/query-builder.js
var QueryBuilder;
var init_query_builder2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/query-builder.js"() {
    init_entity();
    init_selection_proxy();
    init_dialect();
    init_subquery();
    init_select2();
    QueryBuilder = class {
      static {
        __name(this, "QueryBuilder");
      }
      static [entityKind] = "SQLiteQueryBuilder";
      dialect;
      dialectConfig;
      constructor(dialect) {
        this.dialect = is(dialect, SQLiteDialect) ? dialect : void 0;
        this.dialectConfig = is(dialect, SQLiteDialect) ? void 0 : dialect;
      }
      $with = /* @__PURE__ */ __name((alias, selection) => {
        const queryBuilder = this;
        const as = /* @__PURE__ */ __name((qb) => {
          if (typeof qb === "function") {
            qb = qb(queryBuilder);
          }
          return new Proxy(
            new WithSubquery(
              qb.getSQL(),
              selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
              alias,
              true
            ),
            new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
          );
        }, "as");
        return { as };
      }, "$with");
      with(...queries) {
        const self = this;
        function select(fields) {
          return new SQLiteSelectBuilder({
            fields: fields ?? void 0,
            session: void 0,
            dialect: self.getDialect(),
            withList: queries
          });
        }
        __name(select, "select");
        function selectDistinct(fields) {
          return new SQLiteSelectBuilder({
            fields: fields ?? void 0,
            session: void 0,
            dialect: self.getDialect(),
            withList: queries,
            distinct: true
          });
        }
        __name(selectDistinct, "selectDistinct");
        return { select, selectDistinct };
      }
      select(fields) {
        return new SQLiteSelectBuilder({ fields: fields ?? void 0, session: void 0, dialect: this.getDialect() });
      }
      selectDistinct(fields) {
        return new SQLiteSelectBuilder({
          fields: fields ?? void 0,
          session: void 0,
          dialect: this.getDialect(),
          distinct: true
        });
      }
      // Lazy load dialect to avoid circular dependency
      getDialect() {
        if (!this.dialect) {
          this.dialect = new SQLiteSyncDialect(this.dialectConfig);
        }
        return this.dialect;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/insert.js
var SQLiteInsertBuilder, SQLiteInsertBase;
var init_insert = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/insert.js"() {
    init_entity();
    init_query_promise();
    init_sql();
    init_table3();
    init_table();
    init_utils();
    init_utils2();
    init_query_builder2();
    SQLiteInsertBuilder = class {
      static {
        __name(this, "SQLiteInsertBuilder");
      }
      constructor(table, session, dialect, withList) {
        this.table = table;
        this.session = session;
        this.dialect = dialect;
        this.withList = withList;
      }
      static [entityKind] = "SQLiteInsertBuilder";
      values(values) {
        values = Array.isArray(values) ? values : [values];
        if (values.length === 0) {
          throw new Error("values() must be called with at least one value");
        }
        const mappedValues = values.map((entry) => {
          const result = {};
          const cols = this.table[Table.Symbol.Columns];
          for (const colKey of Object.keys(entry)) {
            const colValue = entry[colKey];
            result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
          }
          return result;
        });
        return new SQLiteInsertBase(this.table, mappedValues, this.session, this.dialect, this.withList);
      }
      select(selectQuery) {
        const select = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
        if (!is(select, SQL) && !haveSameKeys(this.table[Columns], select._.selectedFields)) {
          throw new Error(
            "Insert select error: selected fields are not the same or are in a different order compared to the table definition"
          );
        }
        return new SQLiteInsertBase(this.table, select, this.session, this.dialect, this.withList, true);
      }
    };
    SQLiteInsertBase = class extends QueryPromise {
      static {
        __name(this, "SQLiteInsertBase");
      }
      constructor(table, values, session, dialect, withList, select) {
        super();
        this.session = session;
        this.dialect = dialect;
        this.config = { table, values, withList, select };
      }
      static [entityKind] = "SQLiteInsert";
      /** @internal */
      config;
      returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
        this.config.returning = orderSelectedFields(fields);
        return this;
      }
      /**
       * Adds an `on conflict do nothing` clause to the query.
       *
       * Calling this method simply avoids inserting a row as its alternative action.
       *
       * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
       *
       * @param config The `target` and `where` clauses.
       *
       * @example
       * ```ts
       * // Insert one row and cancel the insert if there's a conflict
       * await db.insert(cars)
       *   .values({ id: 1, brand: 'BMW' })
       *   .onConflictDoNothing();
       *
       * // Explicitly specify conflict target
       * await db.insert(cars)
       *   .values({ id: 1, brand: 'BMW' })
       *   .onConflictDoNothing({ target: cars.id });
       * ```
       */
      onConflictDoNothing(config = {}) {
        if (!this.config.onConflict) this.config.onConflict = [];
        if (config.target === void 0) {
          this.config.onConflict.push(sql` on conflict do nothing`);
        } else {
          const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
          const whereSql = config.where ? sql` where ${config.where}` : sql``;
          this.config.onConflict.push(sql` on conflict ${targetSql} do nothing${whereSql}`);
        }
        return this;
      }
      /**
       * Adds an `on conflict do update` clause to the query.
       *
       * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
       *
       * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
       *
       * @param config The `target`, `set` and `where` clauses.
       *
       * @example
       * ```ts
       * // Update the row if there's a conflict
       * await db.insert(cars)
       *   .values({ id: 1, brand: 'BMW' })
       *   .onConflictDoUpdate({
       *     target: cars.id,
       *     set: { brand: 'Porsche' }
       *   });
       *
       * // Upsert with 'where' clause
       * await db.insert(cars)
       *   .values({ id: 1, brand: 'BMW' })
       *   .onConflictDoUpdate({
       *     target: cars.id,
       *     set: { brand: 'newBMW' },
       *     where: sql`${cars.createdAt} > '2023-01-01'::date`,
       *   });
       * ```
       */
      onConflictDoUpdate(config) {
        if (config.where && (config.targetWhere || config.setWhere)) {
          throw new Error(
            'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
          );
        }
        if (!this.config.onConflict) this.config.onConflict = [];
        const whereSql = config.where ? sql` where ${config.where}` : void 0;
        const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
        const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
        const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
        const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
        this.config.onConflict.push(
          sql` on conflict ${targetSql}${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`
        );
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildInsertQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      /** @internal */
      _prepare(isOneTimeQuery = true) {
        return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
          this.dialect.sqlToQuery(this.getSQL()),
          this.config.returning,
          this.config.returning ? "all" : "run",
          true,
          void 0,
          {
            type: "insert",
            tables: extractUsedTable(this.config.table)
          }
        );
      }
      prepare() {
        return this._prepare(false);
      }
      run = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().run(placeholderValues);
      }, "run");
      all = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().all(placeholderValues);
      }, "all");
      get = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().get(placeholderValues);
      }, "get");
      values = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().values(placeholderValues);
      }, "values");
      async execute() {
        return this.config.returning ? this.all() : this.run();
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/select.types.js
var init_select_types = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/select.types.js"() {
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/update.js
var SQLiteUpdateBuilder, SQLiteUpdateBase;
var init_update = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/update.js"() {
    init_entity();
    init_query_promise();
    init_selection_proxy();
    init_table3();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
    init_utils2();
    init_view_base();
    SQLiteUpdateBuilder = class {
      static {
        __name(this, "SQLiteUpdateBuilder");
      }
      constructor(table, session, dialect, withList) {
        this.table = table;
        this.session = session;
        this.dialect = dialect;
        this.withList = withList;
      }
      static [entityKind] = "SQLiteUpdateBuilder";
      set(values) {
        return new SQLiteUpdateBase(
          this.table,
          mapUpdateSet(this.table, values),
          this.session,
          this.dialect,
          this.withList
        );
      }
    };
    SQLiteUpdateBase = class extends QueryPromise {
      static {
        __name(this, "SQLiteUpdateBase");
      }
      constructor(table, set, session, dialect, withList) {
        super();
        this.session = session;
        this.dialect = dialect;
        this.config = { set, table, withList, joins: [] };
      }
      static [entityKind] = "SQLiteUpdate";
      /** @internal */
      config;
      from(source) {
        this.config.from = source;
        return this;
      }
      createJoin(joinType) {
        return (table, on) => {
          const tableName = getTableLikeName(table);
          if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) {
            throw new Error(`Alias "${tableName}" is already used in this query`);
          }
          if (typeof on === "function") {
            const from = this.config.from ? is(table, SQLiteTable) ? table[Table.Symbol.Columns] : is(table, Subquery) ? table._.selectedFields : is(table, SQLiteViewBase) ? table[ViewBaseConfig].selectedFields : void 0 : void 0;
            on = on(
              new Proxy(
                this.config.table[Table.Symbol.Columns],
                new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
              ),
              from && new Proxy(
                from,
                new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
              )
            );
          }
          this.config.joins.push({ on, table, joinType, alias: tableName });
          return this;
        };
      }
      leftJoin = this.createJoin("left");
      rightJoin = this.createJoin("right");
      innerJoin = this.createJoin("inner");
      fullJoin = this.createJoin("full");
      /**
       * Adds a 'where' clause to the query.
       *
       * Calling this method will update only those rows that fulfill a specified condition.
       *
       * See docs: {@link https://orm.drizzle.team/docs/update}
       *
       * @param where the 'where' clause.
       *
       * @example
       * You can use conditional operators and `sql function` to filter the rows to be updated.
       *
       * ```ts
       * // Update all cars with green color
       * db.update(cars).set({ color: 'red' })
       *   .where(eq(cars.color, 'green'));
       * // or
       * db.update(cars).set({ color: 'red' })
       *   .where(sql`${cars.color} = 'green'`)
       * ```
       *
       * You can logically combine conditional operators with `and()` and `or()` operators:
       *
       * ```ts
       * // Update all BMW cars with a green color
       * db.update(cars).set({ color: 'red' })
       *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
       *
       * // Update all cars with the green or blue color
       * db.update(cars).set({ color: 'red' })
       *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
       * ```
       */
      where(where) {
        this.config.where = where;
        return this;
      }
      orderBy(...columns) {
        if (typeof columns[0] === "function") {
          const orderBy = columns[0](
            new Proxy(
              this.config.table[Table.Symbol.Columns],
              new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
            )
          );
          const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
          this.config.orderBy = orderByArray;
        } else {
          const orderByArray = columns;
          this.config.orderBy = orderByArray;
        }
        return this;
      }
      limit(limit) {
        this.config.limit = limit;
        return this;
      }
      returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
        this.config.returning = orderSelectedFields(fields);
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildUpdateQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      /** @internal */
      _prepare(isOneTimeQuery = true) {
        return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
          this.dialect.sqlToQuery(this.getSQL()),
          this.config.returning,
          this.config.returning ? "all" : "run",
          true,
          void 0,
          {
            type: "insert",
            tables: extractUsedTable(this.config.table)
          }
        );
      }
      prepare() {
        return this._prepare(false);
      }
      run = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().run(placeholderValues);
      }, "run");
      all = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().all(placeholderValues);
      }, "all");
      get = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().get(placeholderValues);
      }, "get");
      values = /* @__PURE__ */ __name((placeholderValues) => {
        return this._prepare().values(placeholderValues);
      }, "values");
      async execute() {
        return this.config.returning ? this.all() : this.run();
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/index.js
var init_query_builders = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/index.js"() {
    init_delete();
    init_insert();
    init_query_builder2();
    init_select2();
    init_select_types();
    init_update();
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/count.js
var SQLiteCountBuilder;
var init_count = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/count.js"() {
    init_entity();
    init_sql();
    SQLiteCountBuilder = class _SQLiteCountBuilder extends SQL {
      static {
        __name(this, "SQLiteCountBuilder");
      }
      constructor(params) {
        super(_SQLiteCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
        this.params = params;
        this.session = params.session;
        this.sql = _SQLiteCountBuilder.buildCount(
          params.source,
          params.filters
        );
      }
      sql;
      static [entityKind] = "SQLiteCountBuilderAsync";
      [Symbol.toStringTag] = "SQLiteCountBuilderAsync";
      session;
      static buildEmbeddedCount(source, filters) {
        return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
      }
      static buildCount(source, filters) {
        return sql`select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters}`;
      }
      then(onfulfilled, onrejected) {
        return Promise.resolve(this.session.count(this.sql)).then(
          onfulfilled,
          onrejected
        );
      }
      catch(onRejected) {
        return this.then(void 0, onRejected);
      }
      finally(onFinally) {
        return this.then(
          (value) => {
            onFinally?.();
            return value;
          },
          (reason) => {
            onFinally?.();
            throw reason;
          }
        );
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/query.js
var RelationalQueryBuilder, SQLiteRelationalQuery, SQLiteSyncRelationalQuery;
var init_query = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/query.js"() {
    init_entity();
    init_query_promise();
    init_relations();
    RelationalQueryBuilder = class {
      static {
        __name(this, "RelationalQueryBuilder");
      }
      constructor(mode, fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
        this.mode = mode;
        this.fullSchema = fullSchema;
        this.schema = schema;
        this.tableNamesMap = tableNamesMap;
        this.table = table;
        this.tableConfig = tableConfig;
        this.dialect = dialect;
        this.session = session;
      }
      static [entityKind] = "SQLiteAsyncRelationalQueryBuilder";
      findMany(config) {
        return this.mode === "sync" ? new SQLiteSyncRelationalQuery(
          this.fullSchema,
          this.schema,
          this.tableNamesMap,
          this.table,
          this.tableConfig,
          this.dialect,
          this.session,
          config ? config : {},
          "many"
        ) : new SQLiteRelationalQuery(
          this.fullSchema,
          this.schema,
          this.tableNamesMap,
          this.table,
          this.tableConfig,
          this.dialect,
          this.session,
          config ? config : {},
          "many"
        );
      }
      findFirst(config) {
        return this.mode === "sync" ? new SQLiteSyncRelationalQuery(
          this.fullSchema,
          this.schema,
          this.tableNamesMap,
          this.table,
          this.tableConfig,
          this.dialect,
          this.session,
          config ? { ...config, limit: 1 } : { limit: 1 },
          "first"
        ) : new SQLiteRelationalQuery(
          this.fullSchema,
          this.schema,
          this.tableNamesMap,
          this.table,
          this.tableConfig,
          this.dialect,
          this.session,
          config ? { ...config, limit: 1 } : { limit: 1 },
          "first"
        );
      }
    };
    SQLiteRelationalQuery = class extends QueryPromise {
      static {
        __name(this, "SQLiteRelationalQuery");
      }
      constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
        super();
        this.fullSchema = fullSchema;
        this.schema = schema;
        this.tableNamesMap = tableNamesMap;
        this.table = table;
        this.tableConfig = tableConfig;
        this.dialect = dialect;
        this.session = session;
        this.config = config;
        this.mode = mode;
      }
      static [entityKind] = "SQLiteAsyncRelationalQuery";
      /** @internal */
      mode;
      /** @internal */
      getSQL() {
        return this.dialect.buildRelationalQuery({
          fullSchema: this.fullSchema,
          schema: this.schema,
          tableNamesMap: this.tableNamesMap,
          table: this.table,
          tableConfig: this.tableConfig,
          queryConfig: this.config,
          tableAlias: this.tableConfig.tsName
        }).sql;
      }
      /** @internal */
      _prepare(isOneTimeQuery = false) {
        const { query, builtQuery } = this._toSQL();
        return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
          builtQuery,
          void 0,
          this.mode === "first" ? "get" : "all",
          true,
          (rawRows, mapColumnValue) => {
            const rows = rawRows.map(
              (row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue)
            );
            if (this.mode === "first") {
              return rows[0];
            }
            return rows;
          }
        );
      }
      prepare() {
        return this._prepare(false);
      }
      _toSQL() {
        const query = this.dialect.buildRelationalQuery({
          fullSchema: this.fullSchema,
          schema: this.schema,
          tableNamesMap: this.tableNamesMap,
          table: this.table,
          tableConfig: this.tableConfig,
          queryConfig: this.config,
          tableAlias: this.tableConfig.tsName
        });
        const builtQuery = this.dialect.sqlToQuery(query.sql);
        return { query, builtQuery };
      }
      toSQL() {
        return this._toSQL().builtQuery;
      }
      /** @internal */
      executeRaw() {
        if (this.mode === "first") {
          return this._prepare(false).get();
        }
        return this._prepare(false).all();
      }
      async execute() {
        return this.executeRaw();
      }
    };
    SQLiteSyncRelationalQuery = class extends SQLiteRelationalQuery {
      static {
        __name(this, "SQLiteSyncRelationalQuery");
      }
      static [entityKind] = "SQLiteSyncRelationalQuery";
      sync() {
        return this.executeRaw();
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/raw.js
var SQLiteRaw;
var init_raw = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/query-builders/raw.js"() {
    init_entity();
    init_query_promise();
    SQLiteRaw = class extends QueryPromise {
      static {
        __name(this, "SQLiteRaw");
      }
      constructor(execute, getSQL, action, dialect, mapBatchResult) {
        super();
        this.execute = execute;
        this.getSQL = getSQL;
        this.dialect = dialect;
        this.mapBatchResult = mapBatchResult;
        this.config = { action };
      }
      static [entityKind] = "SQLiteRaw";
      /** @internal */
      config;
      getQuery() {
        return { ...this.dialect.sqlToQuery(this.getSQL()), method: this.config.action };
      }
      mapResult(result, isFromBatch) {
        return isFromBatch ? this.mapBatchResult(result) : result;
      }
      _prepare() {
        return this;
      }
      /** @internal */
      isResponseInArrayMode() {
        return false;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/db.js
var BaseSQLiteDatabase;
var init_db = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/db.js"() {
    init_entity();
    init_selection_proxy();
    init_sql();
    init_query_builders();
    init_subquery();
    init_count();
    init_query();
    init_raw();
    BaseSQLiteDatabase = class {
      static {
        __name(this, "BaseSQLiteDatabase");
      }
      constructor(resultKind, dialect, session, schema) {
        this.resultKind = resultKind;
        this.dialect = dialect;
        this.session = session;
        this._ = schema ? {
          schema: schema.schema,
          fullSchema: schema.fullSchema,
          tableNamesMap: schema.tableNamesMap
        } : {
          schema: void 0,
          fullSchema: {},
          tableNamesMap: {}
        };
        this.query = {};
        const query = this.query;
        if (this._.schema) {
          for (const [tableName, columns] of Object.entries(this._.schema)) {
            query[tableName] = new RelationalQueryBuilder(
              resultKind,
              schema.fullSchema,
              this._.schema,
              this._.tableNamesMap,
              schema.fullSchema[tableName],
              columns,
              dialect,
              session
            );
          }
        }
        this.$cache = { invalidate: /* @__PURE__ */ __name(async (_params) => {
        }, "invalidate") };
      }
      static [entityKind] = "BaseSQLiteDatabase";
      query;
      /**
       * Creates a subquery that defines a temporary named result set as a CTE.
       *
       * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
       *
       * @param alias The alias for the subquery.
       *
       * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
       *
       * @example
       *
       * ```ts
       * // Create a subquery with alias 'sq' and use it in the select query
       * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
       *
       * const result = await db.with(sq).select().from(sq);
       * ```
       *
       * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
       *
       * ```ts
       * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
       * const sq = db.$with('sq').as(db.select({
       *   name: sql<string>`upper(${users.name})`.as('name'),
       * })
       * .from(users));
       *
       * const result = await db.with(sq).select({ name: sq.name }).from(sq);
       * ```
       */
      $with = /* @__PURE__ */ __name((alias, selection) => {
        const self = this;
        const as = /* @__PURE__ */ __name((qb) => {
          if (typeof qb === "function") {
            qb = qb(new QueryBuilder(self.dialect));
          }
          return new Proxy(
            new WithSubquery(
              qb.getSQL(),
              selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
              alias,
              true
            ),
            new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
          );
        }, "as");
        return { as };
      }, "$with");
      $count(source, filters) {
        return new SQLiteCountBuilder({ source, filters, session: this.session });
      }
      /**
       * Incorporates a previously defined CTE (using `$with`) into the main query.
       *
       * This method allows the main query to reference a temporary named result set.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
       *
       * @param queries The CTEs to incorporate into the main query.
       *
       * @example
       *
       * ```ts
       * // Define a subquery 'sq' as a CTE using $with
       * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
       *
       * // Incorporate the CTE 'sq' into the main query and select from it
       * const result = await db.with(sq).select().from(sq);
       * ```
       */
      with(...queries) {
        const self = this;
        function select(fields) {
          return new SQLiteSelectBuilder({
            fields: fields ?? void 0,
            session: self.session,
            dialect: self.dialect,
            withList: queries
          });
        }
        __name(select, "select");
        function selectDistinct(fields) {
          return new SQLiteSelectBuilder({
            fields: fields ?? void 0,
            session: self.session,
            dialect: self.dialect,
            withList: queries,
            distinct: true
          });
        }
        __name(selectDistinct, "selectDistinct");
        function update(table) {
          return new SQLiteUpdateBuilder(table, self.session, self.dialect, queries);
        }
        __name(update, "update");
        function insert(into) {
          return new SQLiteInsertBuilder(into, self.session, self.dialect, queries);
        }
        __name(insert, "insert");
        function delete_(from) {
          return new SQLiteDeleteBase(from, self.session, self.dialect, queries);
        }
        __name(delete_, "delete_");
        return { select, selectDistinct, update, insert, delete: delete_ };
      }
      select(fields) {
        return new SQLiteSelectBuilder({ fields: fields ?? void 0, session: this.session, dialect: this.dialect });
      }
      selectDistinct(fields) {
        return new SQLiteSelectBuilder({
          fields: fields ?? void 0,
          session: this.session,
          dialect: this.dialect,
          distinct: true
        });
      }
      /**
       * Creates an update query.
       *
       * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
       *
       * Use `.set()` method to specify which values to update.
       *
       * See docs: {@link https://orm.drizzle.team/docs/update}
       *
       * @param table The table to update.
       *
       * @example
       *
       * ```ts
       * // Update all rows in the 'cars' table
       * await db.update(cars).set({ color: 'red' });
       *
       * // Update rows with filters and conditions
       * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
       *
       * // Update with returning clause
       * const updatedCar: Car[] = await db.update(cars)
       *   .set({ color: 'red' })
       *   .where(eq(cars.id, 1))
       *   .returning();
       * ```
       */
      update(table) {
        return new SQLiteUpdateBuilder(table, this.session, this.dialect);
      }
      $cache;
      /**
       * Creates an insert query.
       *
       * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
       *
       * See docs: {@link https://orm.drizzle.team/docs/insert}
       *
       * @param table The table to insert into.
       *
       * @example
       *
       * ```ts
       * // Insert one row
       * await db.insert(cars).values({ brand: 'BMW' });
       *
       * // Insert multiple rows
       * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
       *
       * // Insert with returning clause
       * const insertedCar: Car[] = await db.insert(cars)
       *   .values({ brand: 'BMW' })
       *   .returning();
       * ```
       */
      insert(into) {
        return new SQLiteInsertBuilder(into, this.session, this.dialect);
      }
      /**
       * Creates a delete query.
       *
       * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
       *
       * See docs: {@link https://orm.drizzle.team/docs/delete}
       *
       * @param table The table to delete from.
       *
       * @example
       *
       * ```ts
       * // Delete all rows in the 'cars' table
       * await db.delete(cars);
       *
       * // Delete rows with filters and conditions
       * await db.delete(cars).where(eq(cars.color, 'green'));
       *
       * // Delete with returning clause
       * const deletedCar: Car[] = await db.delete(cars)
       *   .where(eq(cars.id, 1))
       *   .returning();
       * ```
       */
      delete(from) {
        return new SQLiteDeleteBase(from, this.session, this.dialect);
      }
      run(query) {
        const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
        if (this.resultKind === "async") {
          return new SQLiteRaw(
            async () => this.session.run(sequel),
            () => sequel,
            "run",
            this.dialect,
            this.session.extractRawRunValueFromBatchResult.bind(this.session)
          );
        }
        return this.session.run(sequel);
      }
      all(query) {
        const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
        if (this.resultKind === "async") {
          return new SQLiteRaw(
            async () => this.session.all(sequel),
            () => sequel,
            "all",
            this.dialect,
            this.session.extractRawAllValueFromBatchResult.bind(this.session)
          );
        }
        return this.session.all(sequel);
      }
      get(query) {
        const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
        if (this.resultKind === "async") {
          return new SQLiteRaw(
            async () => this.session.get(sequel),
            () => sequel,
            "get",
            this.dialect,
            this.session.extractRawGetValueFromBatchResult.bind(this.session)
          );
        }
        return this.session.get(sequel);
      }
      values(query) {
        const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
        if (this.resultKind === "async") {
          return new SQLiteRaw(
            async () => this.session.values(sequel),
            () => sequel,
            "values",
            this.dialect,
            this.session.extractRawValuesValueFromBatchResult.bind(this.session)
          );
        }
        return this.session.values(sequel);
      }
      transaction(transaction, config) {
        return this.session.transaction(transaction, config);
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/cache/core/cache.js
async function hashQuery(sql4, params) {
  const dataToHash = `${sql4}-${JSON.stringify(params)}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(dataToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = [...new Uint8Array(hashBuffer)];
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}
var Cache, NoopCache;
var init_cache = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/cache/core/cache.js"() {
    init_entity();
    Cache = class {
      static {
        __name(this, "Cache");
      }
      static [entityKind] = "Cache";
    };
    NoopCache = class extends Cache {
      static {
        __name(this, "NoopCache");
      }
      strategy() {
        return "all";
      }
      static [entityKind] = "NoopCache";
      async get(_key) {
        return void 0;
      }
      async put(_hashedQuery, _response, _tables, _config) {
      }
      async onMutate(_params) {
      }
    };
    __name(hashQuery, "hashQuery");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/cache/core/index.js
var init_core = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/cache/core/index.js"() {
    init_cache();
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/alias.js
var init_alias2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/alias.js"() {
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/session.js
var ExecuteResultSync, SQLitePreparedQuery, SQLiteSession, SQLiteTransaction;
var init_session = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/session.js"() {
    init_cache();
    init_entity();
    init_errors();
    init_query_promise();
    init_db();
    ExecuteResultSync = class extends QueryPromise {
      static {
        __name(this, "ExecuteResultSync");
      }
      constructor(resultCb) {
        super();
        this.resultCb = resultCb;
      }
      static [entityKind] = "ExecuteResultSync";
      async execute() {
        return this.resultCb();
      }
      sync() {
        return this.resultCb();
      }
    };
    SQLitePreparedQuery = class {
      static {
        __name(this, "SQLitePreparedQuery");
      }
      constructor(mode, executeMethod, query, cache, queryMetadata, cacheConfig) {
        this.mode = mode;
        this.executeMethod = executeMethod;
        this.query = query;
        this.cache = cache;
        this.queryMetadata = queryMetadata;
        this.cacheConfig = cacheConfig;
        if (cache && cache.strategy() === "all" && cacheConfig === void 0) {
          this.cacheConfig = { enable: true, autoInvalidate: true };
        }
        if (!this.cacheConfig?.enable) {
          this.cacheConfig = void 0;
        }
      }
      static [entityKind] = "PreparedQuery";
      /** @internal */
      joinsNotNullableMap;
      /** @internal */
      async queryWithCache(queryString, params, query) {
        if (this.cache === void 0 || is(this.cache, NoopCache) || this.queryMetadata === void 0) {
          try {
            return await query();
          } catch (e) {
            throw new DrizzleQueryError(queryString, params, e);
          }
        }
        if (this.cacheConfig && !this.cacheConfig.enable) {
          try {
            return await query();
          } catch (e) {
            throw new DrizzleQueryError(queryString, params, e);
          }
        }
        if ((this.queryMetadata.type === "insert" || this.queryMetadata.type === "update" || this.queryMetadata.type === "delete") && this.queryMetadata.tables.length > 0) {
          try {
            const [res] = await Promise.all([
              query(),
              this.cache.onMutate({ tables: this.queryMetadata.tables })
            ]);
            return res;
          } catch (e) {
            throw new DrizzleQueryError(queryString, params, e);
          }
        }
        if (!this.cacheConfig) {
          try {
            return await query();
          } catch (e) {
            throw new DrizzleQueryError(queryString, params, e);
          }
        }
        if (this.queryMetadata.type === "select") {
          const fromCache = await this.cache.get(
            this.cacheConfig.tag ?? await hashQuery(queryString, params),
            this.queryMetadata.tables,
            this.cacheConfig.tag !== void 0,
            this.cacheConfig.autoInvalidate
          );
          if (fromCache === void 0) {
            let result;
            try {
              result = await query();
            } catch (e) {
              throw new DrizzleQueryError(queryString, params, e);
            }
            await this.cache.put(
              this.cacheConfig.tag ?? await hashQuery(queryString, params),
              result,
              // make sure we send tables that were used in a query only if user wants to invalidate it on each write
              this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [],
              this.cacheConfig.tag !== void 0,
              this.cacheConfig.config
            );
            return result;
          }
          return fromCache;
        }
        try {
          return await query();
        } catch (e) {
          throw new DrizzleQueryError(queryString, params, e);
        }
      }
      getQuery() {
        return this.query;
      }
      mapRunResult(result, _isFromBatch) {
        return result;
      }
      mapAllResult(_result, _isFromBatch) {
        throw new Error("Not implemented");
      }
      mapGetResult(_result, _isFromBatch) {
        throw new Error("Not implemented");
      }
      execute(placeholderValues) {
        if (this.mode === "async") {
          return this[this.executeMethod](placeholderValues);
        }
        return new ExecuteResultSync(() => this[this.executeMethod](placeholderValues));
      }
      mapResult(response, isFromBatch) {
        switch (this.executeMethod) {
          case "run": {
            return this.mapRunResult(response, isFromBatch);
          }
          case "all": {
            return this.mapAllResult(response, isFromBatch);
          }
          case "get": {
            return this.mapGetResult(response, isFromBatch);
          }
        }
      }
    };
    SQLiteSession = class {
      static {
        __name(this, "SQLiteSession");
      }
      constructor(dialect) {
        this.dialect = dialect;
      }
      static [entityKind] = "SQLiteSession";
      prepareOneTimeQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
        return this.prepareQuery(
          query,
          fields,
          executeMethod,
          isResponseInArrayMode,
          customResultMapper,
          queryMetadata,
          cacheConfig
        );
      }
      run(query) {
        const staticQuery = this.dialect.sqlToQuery(query);
        try {
          return this.prepareOneTimeQuery(staticQuery, void 0, "run", false).run();
        } catch (err) {
          throw new DrizzleError({ cause: err, message: `Failed to run the query '${staticQuery.sql}'` });
        }
      }
      /** @internal */
      extractRawRunValueFromBatchResult(result) {
        return result;
      }
      all(query) {
        return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).all();
      }
      /** @internal */
      extractRawAllValueFromBatchResult(_result) {
        throw new Error("Not implemented");
      }
      get(query) {
        return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).get();
      }
      /** @internal */
      extractRawGetValueFromBatchResult(_result) {
        throw new Error("Not implemented");
      }
      values(query) {
        return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).values();
      }
      async count(sql4) {
        const result = await this.values(sql4);
        return result[0][0];
      }
      /** @internal */
      extractRawValuesValueFromBatchResult(_result) {
        throw new Error("Not implemented");
      }
    };
    SQLiteTransaction = class extends BaseSQLiteDatabase {
      static {
        __name(this, "SQLiteTransaction");
      }
      constructor(resultType, dialect, session, schema, nestedIndex = 0) {
        super(resultType, dialect, session, schema);
        this.schema = schema;
        this.nestedIndex = nestedIndex;
      }
      static [entityKind] = "SQLiteTransaction";
      rollback() {
        throw new TransactionRollbackError();
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/subquery.js
var init_subquery2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/subquery.js"() {
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/view.js
var ViewBuilderCore, ViewBuilder, ManualViewBuilder, SQLiteView;
var init_view = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/view.js"() {
    init_entity();
    init_selection_proxy();
    init_utils();
    init_query_builder2();
    init_table3();
    init_view_base();
    ViewBuilderCore = class {
      static {
        __name(this, "ViewBuilderCore");
      }
      constructor(name) {
        this.name = name;
      }
      static [entityKind] = "SQLiteViewBuilderCore";
      config = {};
    };
    ViewBuilder = class extends ViewBuilderCore {
      static {
        __name(this, "ViewBuilder");
      }
      static [entityKind] = "SQLiteViewBuilder";
      as(qb) {
        if (typeof qb === "function") {
          qb = qb(new QueryBuilder());
        }
        const selectionProxy = new SelectionProxyHandler({
          alias: this.name,
          sqlBehavior: "error",
          sqlAliasedBehavior: "alias",
          replaceOriginalName: true
        });
        const aliasedSelectedFields = qb.getSelectedFields();
        return new Proxy(
          new SQLiteView({
            // sqliteConfig: this.config,
            config: {
              name: this.name,
              schema: void 0,
              selectedFields: aliasedSelectedFields,
              query: qb.getSQL().inlineParams()
            }
          }),
          selectionProxy
        );
      }
    };
    ManualViewBuilder = class extends ViewBuilderCore {
      static {
        __name(this, "ManualViewBuilder");
      }
      static [entityKind] = "SQLiteManualViewBuilder";
      columns;
      constructor(name, columns) {
        super(name);
        this.columns = getTableColumns(sqliteTable(name, columns));
      }
      existing() {
        return new Proxy(
          new SQLiteView({
            config: {
              name: this.name,
              schema: void 0,
              selectedFields: this.columns,
              query: void 0
            }
          }),
          new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true
          })
        );
      }
      as(query) {
        return new Proxy(
          new SQLiteView({
            config: {
              name: this.name,
              schema: void 0,
              selectedFields: this.columns,
              query: query.inlineParams()
            }
          }),
          new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true
          })
        );
      }
    };
    SQLiteView = class extends SQLiteViewBase {
      static {
        __name(this, "SQLiteView");
      }
      static [entityKind] = "SQLiteView";
      constructor({ config }) {
        super(config);
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/index.js
var init_sqlite_core = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/sqlite-core/index.js"() {
    init_alias2();
    init_checks();
    init_columns();
    init_db();
    init_dialect();
    init_foreign_keys2();
    init_indexes();
    init_primary_keys2();
    init_query_builders();
    init_session();
    init_subquery2();
    init_table3();
    init_unique_constraint2();
    init_utils2();
    init_view();
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/d1/session.js
function d1ToRawMapping(results) {
  const rows = [];
  for (const row of results) {
    const entry = Object.keys(row).map((k) => row[k]);
    rows.push(entry);
  }
  return rows;
}
var SQLiteD1Session, D1Transaction, D1PreparedQuery;
var init_session2 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/d1/session.js"() {
    init_core();
    init_entity();
    init_logger();
    init_sql();
    init_sqlite_core();
    init_session();
    init_utils();
    SQLiteD1Session = class extends SQLiteSession {
      static {
        __name(this, "SQLiteD1Session");
      }
      constructor(client, dialect, schema, options = {}) {
        super(dialect);
        this.client = client;
        this.schema = schema;
        this.options = options;
        this.logger = options.logger ?? new NoopLogger();
        this.cache = options.cache ?? new NoopCache();
      }
      static [entityKind] = "SQLiteD1Session";
      logger;
      cache;
      prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
        const stmt = this.client.prepare(query.sql);
        return new D1PreparedQuery(
          stmt,
          query,
          this.logger,
          this.cache,
          queryMetadata,
          cacheConfig,
          fields,
          executeMethod,
          isResponseInArrayMode,
          customResultMapper
        );
      }
      async batch(queries) {
        const preparedQueries = [];
        const builtQueries = [];
        for (const query of queries) {
          const preparedQuery = query._prepare();
          const builtQuery = preparedQuery.getQuery();
          preparedQueries.push(preparedQuery);
          if (builtQuery.params.length > 0) {
            builtQueries.push(preparedQuery.stmt.bind(...builtQuery.params));
          } else {
            const builtQuery2 = preparedQuery.getQuery();
            builtQueries.push(
              this.client.prepare(builtQuery2.sql).bind(...builtQuery2.params)
            );
          }
        }
        const batchResults = await this.client.batch(builtQueries);
        return batchResults.map((result, i) => preparedQueries[i].mapResult(result, true));
      }
      extractRawAllValueFromBatchResult(result) {
        return result.results;
      }
      extractRawGetValueFromBatchResult(result) {
        return result.results[0];
      }
      extractRawValuesValueFromBatchResult(result) {
        return d1ToRawMapping(result.results);
      }
      async transaction(transaction, config) {
        const tx = new D1Transaction("async", this.dialect, this, this.schema);
        await this.run(sql.raw(`begin${config?.behavior ? " " + config.behavior : ""}`));
        try {
          const result = await transaction(tx);
          await this.run(sql`commit`);
          return result;
        } catch (err) {
          await this.run(sql`rollback`);
          throw err;
        }
      }
    };
    D1Transaction = class _D1Transaction extends SQLiteTransaction {
      static {
        __name(this, "D1Transaction");
      }
      static [entityKind] = "D1Transaction";
      async transaction(transaction) {
        const savepointName = `sp${this.nestedIndex}`;
        const tx = new _D1Transaction("async", this.dialect, this.session, this.schema, this.nestedIndex + 1);
        await this.session.run(sql.raw(`savepoint ${savepointName}`));
        try {
          const result = await transaction(tx);
          await this.session.run(sql.raw(`release savepoint ${savepointName}`));
          return result;
        } catch (err) {
          await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
          throw err;
        }
      }
    };
    __name(d1ToRawMapping, "d1ToRawMapping");
    D1PreparedQuery = class extends SQLitePreparedQuery {
      static {
        __name(this, "D1PreparedQuery");
      }
      constructor(stmt, query, logger, cache, queryMetadata, cacheConfig, fields, executeMethod, _isResponseInArrayMode, customResultMapper) {
        super("async", executeMethod, query, cache, queryMetadata, cacheConfig);
        this.logger = logger;
        this._isResponseInArrayMode = _isResponseInArrayMode;
        this.customResultMapper = customResultMapper;
        this.fields = fields;
        this.stmt = stmt;
      }
      static [entityKind] = "D1PreparedQuery";
      /** @internal */
      customResultMapper;
      /** @internal */
      fields;
      /** @internal */
      stmt;
      async run(placeholderValues) {
        const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
        this.logger.logQuery(this.query.sql, params);
        return await this.queryWithCache(this.query.sql, params, async () => {
          return this.stmt.bind(...params).run();
        });
      }
      async all(placeholderValues) {
        const { fields, query, logger, stmt, customResultMapper } = this;
        if (!fields && !customResultMapper) {
          const params = fillPlaceholders(query.params, placeholderValues ?? {});
          logger.logQuery(query.sql, params);
          return await this.queryWithCache(query.sql, params, async () => {
            return stmt.bind(...params).all().then(({ results }) => this.mapAllResult(results));
          });
        }
        const rows = await this.values(placeholderValues);
        return this.mapAllResult(rows);
      }
      mapAllResult(rows, isFromBatch) {
        if (isFromBatch) {
          rows = d1ToRawMapping(rows.results);
        }
        if (!this.fields && !this.customResultMapper) {
          return rows;
        }
        if (this.customResultMapper) {
          return this.customResultMapper(rows);
        }
        return rows.map((row) => mapResultRow(this.fields, row, this.joinsNotNullableMap));
      }
      async get(placeholderValues) {
        const { fields, joinsNotNullableMap, query, logger, stmt, customResultMapper } = this;
        if (!fields && !customResultMapper) {
          const params = fillPlaceholders(query.params, placeholderValues ?? {});
          logger.logQuery(query.sql, params);
          return await this.queryWithCache(query.sql, params, async () => {
            return stmt.bind(...params).all().then(({ results }) => results[0]);
          });
        }
        const rows = await this.values(placeholderValues);
        if (!rows[0]) {
          return void 0;
        }
        if (customResultMapper) {
          return customResultMapper(rows);
        }
        return mapResultRow(fields, rows[0], joinsNotNullableMap);
      }
      mapGetResult(result, isFromBatch) {
        if (isFromBatch) {
          result = d1ToRawMapping(result.results)[0];
        }
        if (!this.fields && !this.customResultMapper) {
          return result;
        }
        if (this.customResultMapper) {
          return this.customResultMapper([result]);
        }
        return mapResultRow(this.fields, result, this.joinsNotNullableMap);
      }
      async values(placeholderValues) {
        const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
        this.logger.logQuery(this.query.sql, params);
        return await this.queryWithCache(this.query.sql, params, async () => {
          return this.stmt.bind(...params).raw();
        });
      }
      /** @internal */
      isResponseInArrayMode() {
        return this._isResponseInArrayMode;
      }
    };
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/d1/driver.js
function drizzle(client, config = {}) {
  const dialect = new SQLiteAsyncDialect({ casing: config.casing });
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }
  let schema;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const session = new SQLiteD1Session(client, dialect, schema, { logger, cache: config.cache });
  const db = new DrizzleD1Database("async", dialect, session, schema);
  db.$client = client;
  db.$cache = config.cache;
  if (db.$cache) {
    db.$cache["invalidate"] = config.cache?.onMutate;
  }
  return db;
}
var DrizzleD1Database;
var init_driver = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/d1/driver.js"() {
    init_entity();
    init_logger();
    init_relations();
    init_db();
    init_dialect();
    init_session2();
    DrizzleD1Database = class extends BaseSQLiteDatabase {
      static {
        __name(this, "DrizzleD1Database");
      }
      static [entityKind] = "D1Database";
      async batch(batch) {
        return this.session.batch(batch);
      }
    };
    __name(drizzle, "drizzle");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/d1/index.js
var init_d1 = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/d1/index.js"() {
    init_driver();
    init_session2();
  }
});

// db/app/schema.ts
var schema_exports = {};
__export(schema_exports, {
  addresses: () => addresses,
  apiKeys: () => apiKeys,
  appSettings: () => appSettings,
  audienceContacts: () => audienceContacts,
  audienceGroups: () => audienceGroups,
  broadcasts: () => broadcasts,
  domainBranding: () => domainBranding,
  domains: () => domains,
  inboundEvents: () => inboundEvents,
  mobilePasswords: () => mobilePasswords,
  ownerConfig: () => ownerConfig,
  ownerSessions: () => ownerSessions,
  webhookFails: () => webhookFails,
  webhookSecrets: () => webhookSecrets,
  webhooks: () => webhooks
});
var domains, addresses, audienceGroups, audienceContacts, broadcasts, domainBranding, apiKeys, mobilePasswords, webhooks, webhookSecrets, webhookFails, appSettings, ownerConfig, ownerSessions, inboundEvents;
var init_schema = __esm({
  "db/app/schema.ts"() {
    "use strict";
    init_sqlite_core();
    domains = sqliteTable("domains", {
      id: text("id").primaryKey(),
      domain: text("domain").notNull().unique(),
      createdAt: text("created_at").notNull()
    });
    addresses = sqliteTable(
      "addresses",
      {
        id: text("id").primaryKey(),
        email: text("email").notNull().unique(),
        domain: text("domain").notNull().references(() => domains.id, {
          onDelete: "cascade"
        }),
        displayName: text("display_name"),
        signature: text("signature"),
        inboundEnabled: integer("inbound_enabled").notNull().default(1),
        mobileEnabled: integer("mobile_enabled").notNull().default(1),
        createdAt: text("created_at").notNull()
      },
      (t) => [index("addresses_domain_idx").on(t.domain)]
    );
    audienceGroups = sqliteTable(
      "audience_groups",
      {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        domain: text("domain").notNull(),
        createdAt: text("created_at").notNull(),
        defaultFrom: text("default_from"),
        dataSourceJson: text("data_source_json"),
        cronEnabled: integer("cron_enabled").notNull().default(0),
        cronIntervalMinutes: integer("cron_interval_minutes"),
        lastSyncAt: text("last_sync_at"),
        lastSyncStatus: text("last_sync_status"),
        lastSyncError: text("last_sync_error"),
        lastSyncCount: integer("last_sync_count"),
        syncProgressJson: text("sync_progress_json"),
        syncHistoryJson: text("sync_history_json")
      },
      (t) => [index("audience_groups_domain_idx").on(t.domain)]
    );
    audienceContacts = sqliteTable(
      "audience_contacts",
      {
        id: text("id").primaryKey(),
        email: text("email").notNull(),
        name: text("name"),
        domain: text("domain").notNull(),
        groupId: text("group_id").notNull().references(() => audienceGroups.id, {
          onDelete: "cascade"
        }),
        source: text("source").notNull(),
        addedAt: text("added_at").notNull()
      },
      (t) => [
        uniqueIndex("audience_contacts_group_email_idx").on(t.groupId, t.email),
        index("audience_contacts_group_idx").on(t.groupId),
        index("audience_contacts_domain_idx").on(t.domain)
      ]
    );
    broadcasts = sqliteTable(
      "broadcasts",
      {
        id: text("id").primaryKey(),
        subject: text("subject").notNull(),
        status: text("status").notNull(),
        createdAt: text("created_at").notNull(),
        domain: text("domain").notNull(),
        groupIdsJson: text("group_ids_json").notNull(),
        fromAddr: text("from_addr"),
        body: text("body"),
        recipientCount: integer("recipient_count"),
        sentAt: text("sent_at"),
        sendProgressJson: text("send_progress_json"),
        sendHistoryJson: text("send_history_json")
      },
      (t) => [
        index("broadcasts_domain_idx").on(t.domain),
        index("broadcasts_status_idx").on(t.status),
        index("broadcasts_created_at_idx").on(t.createdAt)
      ]
    );
    domainBranding = sqliteTable("domain_branding", {
      domain: text("domain").primaryKey(),
      dmarcPolicy: text("dmarc_policy").notNull().default("quarantine"),
      dmarcRua: text("dmarc_rua").notNull()
    });
    apiKeys = sqliteTable(
      "api_keys",
      {
        id: text("id").primaryKey(),
        keyHash: text("key_hash").notNull().unique(),
        domain: text("domain").notNull(),
        label: text("label"),
        keyPrefix: text("key_prefix").notNull(),
        createdAt: text("created_at").notNull(),
        active: integer("active").notNull().default(1)
      },
      (t) => [
        index("api_keys_domain_idx").on(t.domain),
        index("api_keys_active_idx").on(t.active)
      ]
    );
    mobilePasswords = sqliteTable("mobile_passwords", {
      email: text("email").primaryKey(),
      passwordHash: text("password_hash").notNull(),
      salt: text("salt").notNull(),
      updatedAt: text("updated_at").notNull()
    });
    webhooks = sqliteTable(
      "webhooks",
      {
        id: text("id").primaryKey(),
        domain: text("domain").notNull(),
        url: text("url").notNull(),
        secretHash: text("secret_hash").notNull(),
        createdAt: text("created_at").notNull(),
        active: integer("active").notNull().default(1)
      },
      (t) => [
        index("webhooks_domain_idx").on(t.domain),
        index("webhooks_active_idx").on(t.active)
      ]
    );
    webhookSecrets = sqliteTable("webhook_secrets", {
      webhookId: text("webhook_id").primaryKey().references(() => webhooks.id, { onDelete: "cascade" }),
      secret: text("secret").notNull()
    });
    webhookFails = sqliteTable(
      "webhook_fails",
      {
        id: text("id").primaryKey(),
        webhookId: text("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
        eventId: text("event_id").notNull(),
        url: text("url").notNull(),
        failedAt: text("failed_at").notNull(),
        expiresAt: text("expires_at").notNull()
      },
      (t) => [
        index("webhook_fails_webhook_idx").on(t.webhookId),
        index("webhook_fails_expires_idx").on(t.expiresAt)
      ]
    );
    appSettings = sqliteTable("app_settings", {
      id: integer("id").primaryKey(),
      /** NULL = unlimited inbound per domain. Positive = keep newest N inbound. */
      inboundRetainPerDomain: integer("inbound_retain_per_domain"),
      updatedAt: text("updated_at").notNull()
    });
    ownerConfig = sqliteTable("owner_config", {
      id: integer("id").primaryKey(),
      ownerEmail: text("owner_email"),
      workerUrl: text("worker_url"),
      /** Salt for the passtoken hash. */
      passtokenSalt: text("passtoken_salt"),
      /** sha256(pepper || salt || passtoken). Plaintext is shown once at issue. */
      passtokenHash: text("passtoken_hash"),
      passtokenPrefix: text("passtoken_prefix"),
      passtokenUpdatedAt: text("passtoken_updated_at")
    });
    ownerSessions = sqliteTable(
      "owner_sessions",
      {
        id: text("id").primaryKey(),
        /** sha256(refresh). Plaintext lives only in the OS keyring. */
        tokenHash: text("token_hash").notNull().unique(),
        /** Groups access+refresh issued by one login; reuse of a revoked refresh
         *  revokes the whole family. */
        family: text("family").notNull(),
        label: text("label"),
        createdAt: text("created_at").notNull(),
        expiresAt: text("expires_at").notNull()
      },
      (t) => [index("owner_sessions_family_idx").on(t.family)]
    );
    inboundEvents = sqliteTable(
      "inbound_events",
      {
        id: text("id").primaryKey(),
        domain: text("domain").notNull(),
        eventType: text("event_type").notNull(),
        createdAt: text("created_at").notNull(),
        payloadJson: text("payload_json").notNull(),
        expiresAt: text("expires_at").notNull()
      },
      (t) => [
        index("inbound_events_domain_idx").on(t.domain),
        index("inbound_events_expires_idx").on(t.expiresAt)
      ]
    );
  }
});

// db/app/index.ts
function createAppDb(db) {
  if (!db) return null;
  return drizzle(db, { schema: schema_exports });
}
var init_app = __esm({
  "db/app/index.ts"() {
    "use strict";
    init_d1();
    init_schema();
    init_schema();
    __name(createAppDb, "createAppDb");
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/operations.js
var init_operations = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/operations.js"() {
  }
});

// node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/index.js
var init_drizzle_orm = __esm({
  "node_modules/.pnpm/drizzle-orm@0.45.2_@cloudflare+workers-types@4.20260702.1/node_modules/drizzle-orm/index.js"() {
    init_alias();
    init_column_builder();
    init_column();
    init_entity();
    init_errors();
    init_logger();
    init_operations();
    init_query_promise();
    init_relations();
    init_sql2();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
  }
});

// db/app/audience.ts
function rowToGroup(row) {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    createdAt: row.createdAt,
    ...row.defaultFrom ? { defaultFrom: row.defaultFrom } : {},
    ...row.dataSourceJson ? { dataSource: JSON.parse(row.dataSourceJson) } : {},
    ...row.cronEnabled ? { cronEnabled: true, cronIntervalMinutes: row.cronIntervalMinutes ?? void 0 } : {},
    ...row.lastSyncAt ? { lastSyncAt: row.lastSyncAt } : {},
    ...row.lastSyncStatus ? { lastSyncStatus: row.lastSyncStatus } : {},
    ...row.lastSyncError ? { lastSyncError: row.lastSyncError } : {},
    ...row.lastSyncCount != null ? { lastSyncCount: row.lastSyncCount } : {},
    ...row.syncProgressJson ? { syncProgress: JSON.parse(row.syncProgressJson) } : {},
    ...row.syncHistoryJson ? { syncHistory: JSON.parse(row.syncHistoryJson) } : {}
  };
}
function rowToContact(row) {
  return {
    id: row.id,
    email: row.email,
    ...row.name ? { name: row.name } : {},
    domain: row.domain,
    groupId: row.groupId,
    source: row.source,
    addedAt: row.addedAt
  };
}
async function listGroups(db) {
  if (!db) return [];
  const rows = await db.select().from(audienceGroups).orderBy(desc(audienceGroups.createdAt)).all();
  return rows.map(rowToGroup);
}
async function getGroup(db, groupId) {
  if (!db) return null;
  const row = await db.select().from(audienceGroups).where(eq(audienceGroups.id, groupId)).get();
  return row ? rowToGroup(row) : null;
}
async function listContacts(db) {
  if (!db) return [];
  const rows = await db.select().from(audienceContacts).orderBy(desc(audienceContacts.addedAt)).all();
  return rows.map(rowToContact);
}
async function listContactsForGroups(db, groupIds) {
  if (!db || groupIds.length === 0) return [];
  const rows = await db.select().from(audienceContacts).where(inArray(audienceContacts.groupId, groupIds)).all();
  return rows.map(rowToContact);
}
function normalizeDataSource(source) {
  return {
    type: "generic_json",
    endpointUrl: source.endpointUrl.trim(),
    ...source.credential?.trim() ? { credential: source.credential.trim() } : {},
    ...source.credentialHeader?.trim() ? { credentialHeader: source.credentialHeader.trim() } : {}
  };
}
function mergeDataSource(previous, patch) {
  return {
    type: "generic_json",
    endpointUrl: patch.endpointUrl.trim(),
    ...patch.credential?.trim() ? { credential: patch.credential.trim() } : previous?.credential ? { credential: previous.credential } : {},
    ...patch.credentialHeader?.trim() ? { credentialHeader: patch.credentialHeader.trim() } : previous?.credentialHeader ? { credentialHeader: previous.credentialHeader } : {}
  };
}
async function createGroup(db, input) {
  if (!db) throw new Error("D1 not configured");
  const id = crypto.randomUUID();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  await db.insert(audienceGroups).values({
    id,
    name: input.name.trim(),
    domain: input.domain.trim().toLowerCase(),
    createdAt,
    ...input.dataSource ? {
      dataSourceJson: JSON.stringify(normalizeDataSource(input.dataSource))
    } : {},
    cronEnabled: input.cronEnabled ? 1 : 0,
    ...input.cronIntervalMinutes ? { cronIntervalMinutes: input.cronIntervalMinutes } : {}
  }).run();
  return await getGroup(db, id);
}
async function updateGroup(db, groupId, patch) {
  if (!db) throw new Error("D1 not configured");
  const current = await getGroup(db, groupId);
  if (!current) throw new Error("Audience group not found");
  const updates = {};
  if (patch.name !== void 0) {
    const name = patch.name.trim();
    if (!name) throw new Error("name is required");
    updates.name = name;
  }
  if (patch.defaultFrom !== void 0) {
    updates.defaultFrom = patch.defaultFrom === null || !patch.defaultFrom.trim() ? null : patch.defaultFrom.trim().toLowerCase();
  }
  if (patch.dataSource !== void 0) {
    updates.dataSourceJson = patch.dataSource === null ? null : JSON.stringify(
      mergeDataSource(current.dataSource, patch.dataSource)
    );
  }
  if (patch.cronEnabled !== void 0) {
    updates.cronEnabled = patch.cronEnabled ? 1 : 0;
  }
  if (patch.cronIntervalMinutes !== void 0) {
    updates.cronIntervalMinutes = patch.cronIntervalMinutes === null ? null : patch.cronIntervalMinutes;
  }
  await db.update(audienceGroups).set(updates).where(eq(audienceGroups.id, groupId)).run();
  return await getGroup(db, groupId);
}
async function deleteGroup(db, groupId) {
  if (!db) return false;
  const result = await db.delete(audienceGroups).where(eq(audienceGroups.id, groupId)).run();
  return result.meta.changes > 0;
}
async function addManualContact(db, input) {
  if (!db) throw new Error("D1 not configured");
  const id = crypto.randomUUID();
  const email = input.email.trim().toLowerCase();
  const addedAt = (/* @__PURE__ */ new Date()).toISOString();
  await db.insert(audienceContacts).values({
    id,
    email,
    ...input.name?.trim() ? { name: input.name.trim() } : {},
    domain: input.domain.trim().toLowerCase(),
    groupId: input.groupId,
    source: "manual",
    addedAt
  }).run();
  const row = await db.select().from(audienceContacts).where(eq(audienceContacts.id, id)).get();
  return rowToContact(row);
}
async function removeContact(db, contactId) {
  if (!db) return false;
  const result = await db.delete(audienceContacts).where(eq(audienceContacts.id, contactId)).run();
  return result.meta.changes > 0;
}
async function removeContactsByGroup(db, groupId, source) {
  if (!db) return 0;
  const conditions = [eq(audienceContacts.groupId, groupId)];
  if (source) conditions.push(eq(audienceContacts.source, source));
  const result = await db.delete(audienceContacts).where(and(...conditions)).run();
  return result.meta.changes;
}
async function replaceSyncedContacts(db, groupId, domain, contacts) {
  if (!db) throw new Error("D1 not configured");
  await removeContactsByGroup(db, groupId, "synced");
  if (contacts.length === 0) return 0;
  const addedAt = (/* @__PURE__ */ new Date()).toISOString();
  const values = contacts.map((c) => ({
    id: `synced:${groupId}:${c.email}`,
    email: c.email.trim().toLowerCase(),
    ...c.name?.trim() ? { name: c.name.trim() } : {},
    domain: domain.trim().toLowerCase(),
    groupId,
    source: "synced",
    addedAt
  }));
  await db.insert(audienceContacts).values(values).run();
  return values.length;
}
async function updateSyncProgress(db, groupId, progress) {
  if (!db) return;
  await db.update(audienceGroups).set({ syncProgressJson: JSON.stringify(progress) }).where(eq(audienceGroups.id, groupId)).run();
}
async function finishSync(db, groupId, result) {
  if (!db) return;
  const current = await getGroup(db, groupId);
  const history = current?.syncHistory ?? [];
  const nextHistory = [result.run, ...history].slice(0, SYNC_HISTORY_LIMIT);
  await db.update(audienceGroups).set({
    syncProgressJson: JSON.stringify(result.run),
    syncHistoryJson: JSON.stringify(nextHistory),
    lastSyncAt: result.lastSyncAt,
    lastSyncStatus: result.lastSyncStatus,
    lastSyncError: result.lastSyncError ?? null,
    lastSyncCount: result.lastSyncCount
  }).where(eq(audienceGroups.id, groupId)).run();
}
async function listGroupsForCron(db) {
  if (!db) return [];
  const rows = await db.select().from(audienceGroups).where(eq(audienceGroups.cronEnabled, 1)).all();
  return rows.map(rowToGroup);
}
var SYNC_HISTORY_LIMIT;
var init_audience = __esm({
  "db/app/audience.ts"() {
    "use strict";
    init_drizzle_orm();
    init_schema();
    SYNC_HISTORY_LIMIT = 20;
    __name(rowToGroup, "rowToGroup");
    __name(rowToContact, "rowToContact");
    __name(listGroups, "listGroups");
    __name(getGroup, "getGroup");
    __name(listContacts, "listContacts");
    __name(listContactsForGroups, "listContactsForGroups");
    __name(normalizeDataSource, "normalizeDataSource");
    __name(mergeDataSource, "mergeDataSource");
    __name(createGroup, "createGroup");
    __name(updateGroup, "updateGroup");
    __name(deleteGroup, "deleteGroup");
    __name(addManualContact, "addManualContact");
    __name(removeContact, "removeContact");
    __name(removeContactsByGroup, "removeContactsByGroup");
    __name(replaceSyncedContacts, "replaceSyncedContacts");
    __name(updateSyncProgress, "updateSyncProgress");
    __name(finishSync, "finishSync");
    __name(listGroupsForCron, "listGroupsForCron");
  }
});

// db/app/mailbox.ts
function normalizeDomain(input) {
  return input.trim().toLowerCase().replace(/\.$/, "");
}
function rowToAddress(row) {
  return {
    email: row.email,
    domain: row.domain,
    ...row.displayName ? { displayName: row.displayName } : {},
    ...row.signature ? { signature: row.signature } : {},
    ...row.inboundEnabled === 0 ? { inboundEnabled: false } : {},
    ...row.mobileEnabled === 0 ? { mobileEnabled: false } : {}
  };
}
async function readMailbox(db) {
  if (!db) return { domains: [], addresses: [] };
  const [domainRows, addressRows] = await Promise.all([
    db.select().from(domains).orderBy(asc(domains.domain)).all(),
    db.select().from(addresses).all()
  ]);
  return {
    domains: domainRows.map((r) => r.domain),
    addresses: addressRows.map(rowToAddress)
  };
}
async function addDomain(db, domainInput) {
  if (!db) return;
  const domain = normalizeDomain(domainInput);
  if (!domain || domain === "example.com") {
    throw new Error("A valid domain is required");
  }
  await db.insert(domains).values({ id: domain, domain, createdAt: (/* @__PURE__ */ new Date()).toISOString() }).onConflictDoNothing().run();
}
async function removeDomain(db, domainInput) {
  if (!db) return;
  const domain = normalizeDomain(domainInput);
  await db.delete(domains).where(eq(domains.id, domain)).run();
}
async function upsertAddresses(db, domainInput, entries) {
  if (!db) return { added: [] };
  const domain = normalizeDomain(domainInput);
  await addDomain(db, domain);
  const added = [];
  for (const entry of entries) {
    const email = entry.email.trim().toLowerCase();
    if (!email.endsWith(`@${domain}`)) continue;
    const values = {
      id: email,
      email,
      domain,
      ...entry.displayName?.trim() ? { displayName: entry.displayName.trim() } : {},
      inboundEnabled: entry.inboundEnabled === false ? 0 : 1,
      mobileEnabled: entry.mobileEnabled === false ? 0 : 1,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.insert(addresses).values(values).onConflictDoUpdate({
      target: addresses.email,
      set: {
        displayName: values.displayName ?? null,
        inboundEnabled: values.inboundEnabled,
        mobileEnabled: values.mobileEnabled
      }
    }).run();
    added.push({
      email,
      domain,
      ...values.displayName ? { displayName: values.displayName } : {},
      ...entry.inboundEnabled === false ? { inboundEnabled: false } : {},
      ...entry.mobileEnabled === false ? { mobileEnabled: false } : {}
    });
  }
  return { added };
}
async function removeAddress(db, emailInput) {
  if (!db) return null;
  const email = emailInput.trim().toLowerCase();
  const row = await db.select().from(addresses).where(eq(addresses.email, email)).get();
  if (!row) return null;
  await db.delete(addresses).where(eq(addresses.email, email)).run();
  return rowToAddress(row);
}
async function updateAddressProfile(db, emailInput, patch) {
  if (!db) return null;
  const email = emailInput.trim().toLowerCase();
  const row = await db.select().from(addresses).where(eq(addresses.email, email)).get();
  if (!row) return null;
  const displayName = patch.displayName !== void 0 ? patch.displayName.trim() : row.displayName ?? "";
  const signature = patch.signature !== void 0 ? patch.signature : row.signature ?? "";
  await db.update(addresses).set({
    displayName: displayName || null,
    signature: signature || null
  }).where(eq(addresses.email, email)).run();
  return {
    email: row.email,
    domain: row.domain,
    ...displayName ? { displayName } : {},
    ...signature ? { signature } : {},
    ...row.inboundEnabled === 0 ? { inboundEnabled: false } : {},
    ...row.mobileEnabled === 0 ? { mobileEnabled: false } : {}
  };
}
async function replaceMailbox(db, data) {
  if (!db) return;
  await db.delete(addresses).run();
  await db.delete(domains).run();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const domain of data.domains) {
    await db.insert(domains).values({ id: domain, domain, createdAt: now }).onConflictDoNothing().run();
  }
  for (const addr of data.addresses) {
    const email = addr.email.trim().toLowerCase();
    await db.insert(addresses).values({
      id: email,
      email,
      domain: addr.domain,
      ...addr.displayName ? { displayName: addr.displayName } : {},
      ...addr.signature ? { signature: addr.signature } : {},
      inboundEnabled: addr.inboundEnabled === false ? 0 : 1,
      mobileEnabled: addr.mobileEnabled === false ? 0 : 1,
      createdAt: now
    }).onConflictDoUpdate({
      target: addresses.email,
      set: {
        domain: addr.domain,
        displayName: addr.displayName ?? null,
        signature: addr.signature ?? null,
        inboundEnabled: addr.inboundEnabled === false ? 0 : 1,
        mobileEnabled: addr.mobileEnabled === false ? 0 : 1
      }
    }).run();
  }
}
async function updateAddress(db, emailInput, patch) {
  if (!db) return null;
  const email = emailInput.trim().toLowerCase();
  const row = await db.select().from(addresses).where(eq(addresses.email, email)).get();
  if (!row) return null;
  const updates = {};
  if (patch.displayName !== void 0) {
    updates.displayName = patch.displayName === null || !patch.displayName.trim() ? null : patch.displayName.trim();
  }
  if (patch.signature !== void 0) {
    updates.signature = patch.signature === null || !patch.signature ? null : patch.signature;
  }
  if (patch.inboundEnabled !== void 0) {
    updates.inboundEnabled = patch.inboundEnabled ? 1 : 0;
  }
  if (patch.mobileEnabled !== void 0) {
    updates.mobileEnabled = patch.mobileEnabled ? 1 : 0;
  }
  await db.update(addresses).set(updates).where(eq(addresses.email, email)).run();
  const updated = await db.select().from(addresses).where(eq(addresses.email, email)).get();
  return updated ? rowToAddress(updated) : null;
}
var init_mailbox = __esm({
  "db/app/mailbox.ts"() {
    "use strict";
    init_drizzle_orm();
    init_schema();
    __name(normalizeDomain, "normalizeDomain");
    __name(rowToAddress, "rowToAddress");
    __name(readMailbox, "readMailbox");
    __name(addDomain, "addDomain");
    __name(removeDomain, "removeDomain");
    __name(upsertAddresses, "upsertAddresses");
    __name(removeAddress, "removeAddress");
    __name(updateAddressProfile, "updateAddressProfile");
    __name(replaceMailbox, "replaceMailbox");
    __name(updateAddress, "updateAddress");
  }
});

// src/lib/catalog-store.ts
function normalizeMailboxAddress(input) {
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  const signature = typeof input.signature === "string" ? input.signature : "";
  return {
    email: input.email.trim().toLowerCase(),
    domain: normalizeDomain2(input.domain),
    ...displayName ? { displayName } : {},
    ...signature ? { signature } : {},
    ...input.inboundEnabled === false ? { inboundEnabled: false } : {},
    ...input.mobileEnabled === false ? { mobileEnabled: false } : {}
  };
}
function normalizeDomain2(input) {
  return input.trim().toLowerCase().replace(/\.$/, "");
}
async function readMailbox2(db) {
  return readMailbox(db);
}
async function writeMailbox(db, data) {
  await replaceMailbox(db, data);
}
async function addDomain2(db, domainInput) {
  await addDomain(db, domainInput);
  return readMailbox2(db);
}
async function removeDomain2(db, domainInput) {
  await removeDomain(db, domainInput);
  return readMailbox2(db);
}
async function upsertAddresses2(db, domainInput, entries) {
  const { added } = await upsertAddresses(db, domainInput, entries);
  const data = await readMailbox2(db);
  return { data, added };
}
async function removeAddress2(db, emailInput) {
  const removed = await removeAddress(db, emailInput);
  const data = await readMailbox2(db);
  return { data, removed };
}
function mobileEnabledAddresses(data) {
  return data.addresses.filter((a) => a.mobileEnabled !== false);
}
async function updateAddressProfile2(db, emailInput, patch) {
  return updateAddressProfile(db, emailInput, patch);
}
function listDomainSummaries(data) {
  return data.domains.map((domain) => ({
    domain,
    active: false,
    addressCount: data.addresses.filter((a) => a.domain === domain).length,
    audienceCount: 0,
    broadcastCount: 0,
    sentCount: 0,
    r2Provisioned: true,
    r2BucketName: null,
    r2WorkerReady: true,
    // Packaged desktop has no Next onboarding pipeline — mark ready so
    // DomainStore.waitForOnboarding resolves and can seed addresses.
    onboarding: {
      status: "ready",
      currentStep: null,
      currentStepLabel: null,
      lastError: null,
      lastErrorCode: null,
      zoneId: null,
      sendingSubdomainId: null,
      mxConflicts: [],
      steps: []
    }
  }));
}
async function updateAddress2(db, emailInput, patch) {
  return updateAddress(db, emailInput, patch);
}
var init_catalog_store = __esm({
  "src/lib/catalog-store.ts"() {
    "use strict";
    init_mailbox();
    __name(normalizeMailboxAddress, "normalizeMailboxAddress");
    __name(normalizeDomain2, "normalizeDomain");
    __name(readMailbox2, "readMailbox");
    __name(writeMailbox, "writeMailbox");
    __name(addDomain2, "addDomain");
    __name(removeDomain2, "removeDomain");
    __name(upsertAddresses2, "upsertAddresses");
    __name(removeAddress2, "removeAddress");
    __name(mobileEnabledAddresses, "mobileEnabledAddresses");
    __name(updateAddressProfile2, "updateAddressProfile");
    __name(listDomainSummaries, "listDomainSummaries");
    __name(updateAddress2, "updateAddress");
  }
});

// db/app/broadcasts.ts
function rowToBroadcast(row) {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    createdAt: row.createdAt,
    domain: row.domain,
    groupIds: JSON.parse(row.groupIdsJson),
    ...row.fromAddr ? { from: row.fromAddr } : {},
    ...row.body ? { body: row.body } : {},
    ...row.recipientCount != null ? { recipientCount: row.recipientCount } : {},
    ...row.sentAt ? { sentAt: row.sentAt } : {},
    ...row.sendProgressJson ? { sendProgress: JSON.parse(row.sendProgressJson) } : {},
    ...row.sendHistoryJson ? { sendHistory: JSON.parse(row.sendHistoryJson) } : {}
  };
}
async function listBroadcasts(db) {
  if (!db) return [];
  const rows = await db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).all();
  return rows.map(rowToBroadcast);
}
async function getBroadcast(db, id) {
  if (!db) return null;
  const row = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).get();
  return row ? rowToBroadcast(row) : null;
}
async function createBroadcastRow(db, input) {
  if (!db) return;
  await db.insert(broadcasts).values({
    id: input.id,
    subject: input.subject,
    status: "draft",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    domain: input.domain,
    groupIdsJson: JSON.stringify(input.groupIds)
  }).run();
}
async function updateBroadcastDraft(db, id, patch) {
  if (!db) return;
  const updates = {};
  if (patch.subject !== void 0) updates.subject = patch.subject;
  if (patch.body !== void 0) updates.body = patch.body;
  if (patch.groupIds !== void 0) updates.groupIdsJson = JSON.stringify(patch.groupIds);
  if (patch.from !== void 0) updates.fromAddr = patch.from ?? null;
  await db.update(broadcasts).set(updates).where(eq(broadcasts.id, id)).run();
}
async function updateBroadcastSendProgress(db, id, progress) {
  if (!db) return;
  await db.update(broadcasts).set({ sendProgressJson: JSON.stringify(progress) }).where(eq(broadcasts.id, id)).run();
}
async function finishBroadcastSend(db, id, result) {
  if (!db) return;
  const current = await getBroadcast(db, id);
  const history = current?.sendHistory ?? [];
  const nextHistory = [result.run, ...history].slice(0, BROADCAST_HISTORY_LIMIT);
  await db.update(broadcasts).set({
    status: result.status,
    sendProgressJson: JSON.stringify(result.run),
    sendHistoryJson: JSON.stringify(nextHistory),
    ...result.recipientCount != null ? { recipientCount: result.recipientCount } : {},
    ...result.from ? { fromAddr: result.from } : {},
    ...result.status === "sent" || result.status === "failed" ? { sentAt: (/* @__PURE__ */ new Date()).toISOString() } : {}
  }).where(eq(broadcasts.id, id)).run();
}
async function deleteBroadcastRow(db, id) {
  if (!db) return false;
  const result = await db.delete(broadcasts).where(eq(broadcasts.id, id)).run();
  return result.meta.changes > 0;
}
async function updateBroadcastGroupIds(db, id, groupIds) {
  if (!db) return;
  await db.update(broadcasts).set({ groupIdsJson: JSON.stringify(groupIds) }).where(eq(broadcasts.id, id)).run();
}
var BROADCAST_HISTORY_LIMIT;
var init_broadcasts = __esm({
  "db/app/broadcasts.ts"() {
    "use strict";
    init_drizzle_orm();
    init_schema();
    BROADCAST_HISTORY_LIMIT = 20;
    __name(rowToBroadcast, "rowToBroadcast");
    __name(listBroadcasts, "listBroadcasts");
    __name(getBroadcast, "getBroadcast");
    __name(createBroadcastRow, "createBroadcastRow");
    __name(updateBroadcastDraft, "updateBroadcastDraft");
    __name(updateBroadcastSendProgress, "updateBroadcastSendProgress");
    __name(finishBroadcastSend, "finishBroadcastSend");
    __name(deleteBroadcastRow, "deleteBroadcastRow");
    __name(updateBroadcastGroupIds, "updateBroadcastGroupIds");
  }
});

// src/lib/cloudflare-api-hints.ts
function messageLooksLikePlanError(message) {
  const lower = message.toLowerCase();
  return lower.includes("[10105]") || lower.includes("not_entitled") || lower.includes("not entitled") || lower.includes("workers paid") || lower.includes("paid plan");
}
function isCloudflarePlanError(input) {
  if (!input) return false;
  if (Array.isArray(input)) {
    const code = input[0]?.code;
    const msg = input[0]?.message ?? "";
    if (code === 10105) return true;
    return messageLooksLikePlanError(msg);
  }
  return messageLooksLikePlanError(input);
}
function cloudflareSendErrorBody(message) {
  if (isCloudflarePlanError(message)) {
    return {
      error: "Sending requires a Cloudflare Workers Paid plan (~$5/mo, billed by Cloudflare).",
      code: CF_WORKERS_PAID_REQUIRED_CODE
    };
  }
  return { error: message };
}
function cloudflarePermissionHint(path, method = "GET") {
  const m = method.toUpperCase();
  const p = path.split("?")[0] ?? path;
  if (p.includes("/email/sending/send")) {
    return [
      `Endpoint: ${m} /accounts/{{account_id}}/email/sending/send`,
      "Required: Account \u2192 Email Sending \u2192 Edit",
      "The From domain must be onboarded in Cloudflare \u2192 Email Service \u2192 Email Sending.",
      "Before onboarding, you can only send to verified destination addresses."
    ].join("\n");
  }
  if (p.includes("/email/routing/enable")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/routing/enable`,
      "Required: Zone \u2192 Zone Settings \u2192 Edit"
    ].join("\n");
  }
  if (p.includes("/email/routing/rules")) {
    return [
      `Endpoint: ${m} /zones/{{zone_id}}/email/routing/rules`,
      "Required: Zone \u2192 Email Routing Rules \u2192 Edit"
    ].join("\n");
  }
  if (p.includes("/zones") && !p.includes("/email/")) {
    return [
      `Endpoint: ${m} /zones`,
      "Required: Zone \u2192 Zone \u2192 Read"
    ].join("\n");
  }
  return null;
}
function cloudflareSendingErrorHint(errors) {
  const code = errors?.[0]?.code;
  const msg = errors?.[0]?.message ?? "";
  if (code === 10002 || msg.includes("internal_server")) {
    return [
      "Cloudflare returned an internal sending error (10002). Common causes:",
      "\u2022 The From domain is not onboarded in Cloudflare Email Sending",
      "\u2022 Sending DNS records are missing or not verified yet",
      "\u2022 API token needs Account \u2192 Email Sending \u2192 Edit",
      "\u2022 Before the domain is fully enabled, send only to verified destination addresses",
      "Retry after fixing setup; if it persists, check Cloudflare status or support."
    ].join("\n");
  }
  if (code === 10203 || msg.includes("sending_disabled")) {
    return "Email Sending is disabled for this domain or account. Onboard the domain in Cloudflare Email Sending and verify DNS records.";
  }
  if (code === 10105 || msg.includes("not_entitled")) {
    return "This Cloudflare account is not entitled to Email Sending. Enroll in Email Service in the Cloudflare dashboard.";
  }
  if (code === 10102 || code === 10103 || msg.includes("forbidden")) {
    return "API token lacks Email Sending permission. Add Account \u2192 Email Sending \u2192 Edit.";
  }
  if (code === 10100 || msg.includes("upstream")) {
    return "Cloudflare authentication service is temporarily unavailable. Retry in a few minutes.";
  }
  return null;
}
var CF_WORKERS_PAID_REQUIRED_CODE;
var init_cloudflare_api_hints = __esm({
  "src/lib/cloudflare-api-hints.ts"() {
    "use strict";
    CF_WORKERS_PAID_REQUIRED_CODE = "cf_workers_paid_required";
    __name(messageLooksLikePlanError, "messageLooksLikePlanError");
    __name(isCloudflarePlanError, "isCloudflarePlanError");
    __name(cloudflareSendErrorBody, "cloudflareSendErrorBody");
    __name(cloudflarePermissionHint, "cloudflarePermissionHint");
    __name(cloudflareSendingErrorHint, "cloudflareSendingErrorHint");
  }
});

// src/lib/mime.ts
function escapeDisplayName(name) {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function formatMailboxHeader(address, displayName) {
  const name = displayName?.trim();
  if (!name) return address.trim();
  return `"${escapeDisplayName(name)}" <${address.trim()}>`;
}
function formatAddressList(addresses2) {
  const list = Array.isArray(addresses2) ? addresses2 : [addresses2];
  return list.map((address) => address.trim()).filter(Boolean).join(", ");
}
function normalizeMessageId(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  return `<${trimmed.replace(/^<|>$/g, "")}>`;
}
function buildReferences(params) {
  const inReplyTo = params.inReplyTo?.trim() ? normalizeMessageId(params.inReplyTo) : "";
  const prior = (params.references ?? "").split(/\s+/).map((part) => part.trim()).filter(Boolean).map(normalizeMessageId);
  const ids = [];
  for (const id of [...prior, inReplyTo]) {
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.length ? ids.join(" ") : void 0;
}
function generateMessageId(fromAddress) {
  const domain = fromAddress.includes("@") ? fromAddress.slice(fromAddress.lastIndexOf("@") + 1).trim().toLowerCase() : "relaybase.local";
  const random = crypto.randomUUID().replace(/-/g, "");
  return `<${random}@${domain || "relaybase.local"}>`;
}
function buildMimeMessage(params) {
  const messageId = params.messageId?.trim() ? normalizeMessageId(params.messageId) : generateMessageId(params.from);
  const inReplyTo = params.inReplyTo?.trim() ? normalizeMessageId(params.inReplyTo) : void 0;
  const references = buildReferences({
    inReplyTo: params.inReplyTo,
    references: params.references
  });
  const headers = [
    `From: ${formatMailboxHeader(params.from, params.fromName)}`,
    `To: ${formatAddressList(params.to)}`,
    ...params.cc && formatAddressList(params.cc) ? [`Cc: ${formatAddressList(params.cc)}`] : [],
    ...params.replyTo?.trim() ? [`Reply-To: ${params.replyTo.trim()}`] : [],
    `Message-ID: ${messageId}`,
    ...inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : [],
    ...references ? [`References: ${references}`] : [],
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0"
  ];
  const html = params.html?.trim();
  if (html) {
    const boundary = `relaybase-${Date.now().toString(36)}`;
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      params.text,
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      html,
      `--${boundary}--`,
      ""
    ].join("\r\n");
  }
  return [
    ...headers,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    params.text,
    ""
  ].join("\r\n");
}
function buildStrippedInboundMime(params) {
  const mime = buildMimeMessage({
    from: params.fromEmail,
    fromName: params.fromName,
    to: params.toEmail,
    cc: params.ccEmails?.length ? params.ccEmails : void 0,
    subject: params.subject,
    text: params.bodyText || "(no text body)",
    html: params.bodyHtml ?? void 0,
    messageId: params.messageId ?? void 0
  });
  const lines = mime.split("\r\n");
  const mimeVersionIdx = lines.findIndex((line) => line.startsWith("MIME-Version:"));
  const insertAt = mimeVersionIdx >= 0 ? mimeVersionIdx : 0;
  const extra = [
    "X-Relaybase-Stripped: 1",
    ...params.attachments.map(
      (attachment) => `X-Relaybase-Attachment: id=${attachment.id}; filename="${attachment.filename.replace(/"/g, '\\"')}"; type=${attachment.contentType}; size=${attachment.size}`
    )
  ];
  lines.splice(insertAt, 0, ...extra);
  return new TextEncoder().encode(lines.join("\r\n")).buffer;
}
var init_mime = __esm({
  "src/lib/mime.ts"() {
    "use strict";
    __name(escapeDisplayName, "escapeDisplayName");
    __name(formatMailboxHeader, "formatMailboxHeader");
    __name(formatAddressList, "formatAddressList");
    __name(normalizeMessageId, "normalizeMessageId");
    __name(buildReferences, "buildReferences");
    __name(generateMessageId, "generateMessageId");
    __name(buildMimeMessage, "buildMimeMessage");
    __name(buildStrippedInboundMime, "buildStrippedInboundMime");
  }
});

// src/lib/cloudflare-client.ts
function normalizeCfResponse(raw2) {
  if (Array.isArray(raw2.errors) || typeof raw2.success === "boolean") {
    return raw2;
  }
  if (raw2.code != null) {
    return {
      success: false,
      errors: [
        {
          code: raw2.code,
          message: raw2.error ?? raw2.message ?? "Unknown error"
        }
      ],
      result: null
    };
  }
  return {
    success: false,
    errors: [{ message: raw2.error ?? raw2.message ?? "Unknown error" }],
    result: null
  };
}
var API_BASE, CloudflareClient, SendingOnboardApiMissingError;
var init_cloudflare_client = __esm({
  "src/lib/cloudflare-client.ts"() {
    "use strict";
    init_cloudflare_api_hints();
    init_mime();
    API_BASE = "https://api.cloudflare.com/client/v4";
    __name(normalizeCfResponse, "normalizeCfResponse");
    CloudflareClient = class {
      static {
        __name(this, "CloudflareClient");
      }
      accountId;
      apiToken;
      constructor(credentials) {
        this.accountId = credentials.accountId;
        this.apiToken = credentials.apiToken;
      }
      tokenHeaders() {
        return {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json"
        };
      }
      async sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
      }
      async requestOnce(path, init) {
        const res = await fetch(`${API_BASE}${path}`, {
          ...init,
          headers: { ...this.tokenHeaders(), ...init?.headers }
        });
        let raw2;
        try {
          raw2 = await res.json();
        } catch {
          raw2 = { error: `HTTP ${res.status}` };
        }
        const data = normalizeCfResponse(raw2);
        return { res, data };
      }
      formatCfError(res, data, path, method) {
        const details = data.errors?.map(
          (e) => e.code != null ? `[${e.code}] ${e.message}` : e.message
        ).join("; ") || `HTTP ${res.status}`;
        const isAuthError = res.status === 401 || res.status === 403 || data.errors?.some(
          (e) => e.code === 1e4 || e.code === 10101 || e.code === 10102 || e.code === 10103 || e.message?.toLowerCase().includes("authentication") || e.message?.toLowerCase().includes("unauthorized")
        );
        const lines = [`Cloudflare API: ${details}`, `API: ${(method ?? "GET").toUpperCase()} ${path}`];
        if (isAuthError) {
          const hint = cloudflarePermissionHint(path, method ?? "GET");
          if (hint) lines.push("", hint);
        } else {
          const sendingHint = cloudflareSendingErrorHint(data.errors);
          if (sendingHint) lines.push("", sendingHint);
        }
        return new Error(lines.join("\n"));
      }
      async request(path, init) {
        const { res, data } = await this.requestOnce(path, init);
        if (res.ok && data.success) return data;
        throw this.formatCfError(res, data, path, init?.method ?? "GET");
      }
      async sendWithRetry(path, init) {
        const maxAttempts = 3;
        let lastError = null;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            return await this.request(path, init);
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const retryable = lastError.message.includes("[10002]") || lastError.message.includes("[10100]");
            if (!retryable || attempt === maxAttempts - 1) throw lastError;
            await this.sleep(1500 * (attempt + 1));
          }
        }
        throw lastError ?? new Error("Cloudflare Email Sending request failed");
      }
      mapSendResult(data) {
        return {
          messageId: data.result.message_id ?? `cf-${data.result.delivered?.[0] ?? data.result.queued?.[0] ?? "sent"}-${Date.now()}`,
          delivered: data.result.delivered ?? [],
          permanentBounces: data.result.permanent_bounces ?? [],
          queued: data.result.queued ?? []
        };
      }
      async sendStructuredEmail(params) {
        const fromAddress = params.from.trim();
        const fromName = params.fromName?.trim();
        const body = {
          from: fromName ? { address: fromAddress, name: fromName } : fromAddress,
          to: params.to,
          subject: params.subject,
          text: params.text
        };
        if (params.cc) body.cc = params.cc;
        const html = params.html?.trim();
        if (html) body.html = html;
        const replyTo = params.replyTo?.trim();
        if (replyTo) body.reply_to = replyTo;
        const path = `/accounts/${this.accountId}/email/sending/send`;
        const data = await this.sendWithRetry(path, {
          method: "POST",
          body: JSON.stringify(body)
        });
        return this.mapSendResult(data);
      }
      async sendRawEmail(params) {
        const fromAddress = params.from.trim();
        const toList = Array.isArray(params.to) ? params.to : [params.to];
        const ccList = params.cc ? Array.isArray(params.cc) ? params.cc : [params.cc] : [];
        const recipients = [...toList, ...ccList].map((address) => address.trim()).filter(Boolean);
        const mimeMessage = buildMimeMessage({
          from: fromAddress,
          fromName: params.fromName,
          to: params.to,
          cc: params.cc,
          subject: params.subject,
          text: params.text,
          html: params.html,
          replyTo: params.replyTo,
          inReplyTo: params.inReplyTo,
          references: params.references
        });
        const path = `/accounts/${this.accountId}/email/sending/send_raw`;
        const data = await this.sendWithRetry(path, {
          method: "POST",
          body: JSON.stringify({
            from: fromAddress,
            recipients,
            mime_message: mimeMessage
          })
        });
        return this.mapSendResult(data);
      }
      async sendEmail(params) {
        const fromName = params.fromName?.trim();
        const needsRaw = Boolean(
          fromName || params.inReplyTo?.trim() || params.references?.trim()
        );
        if (needsRaw) {
          return this.sendRawEmail({ ...params, fromName });
        }
        return this.sendStructuredEmail(params);
      }
      async listZones() {
        const zones = [];
        const account = encodeURIComponent(this.accountId);
        let page = 1;
        for (; ; ) {
          const data = await this.request(`/zones?account.id=${account}&per_page=50&page=${page}`);
          const batch = data.result ?? [];
          if (batch.length === 0) break;
          for (const zone of batch) {
            zones.push({
              id: zone.id ?? "",
              name: zone.name ?? "",
              status: zone.status ?? ""
            });
          }
          if (batch.length < 50) break;
          page += 1;
        }
        return zones;
      }
      async resolveZoneId(domain) {
        const data = await this.request(
          `/zones?name=${encodeURIComponent(domain.trim())}`
        );
        const zone = data.result?.find(
          (item) => item.name.toLowerCase() === domain.trim().toLowerCase()
        );
        return zone?.id ?? data.result?.[0]?.id ?? null;
      }
      async listDnsRecords(zoneId, opts = {}) {
        const params = new URLSearchParams();
        if (opts.type) params.set("type", opts.type);
        if (opts.name) params.set("name", opts.name);
        const query = params.toString() ? `?${params.toString()}` : "";
        const data = await this.request(
          `/zones/${zoneId}/dns_records${query}`
        );
        return data.result ?? [];
      }
      async createDnsRecord(zoneId, record) {
        const data = await this.request(
          `/zones/${zoneId}/dns_records`,
          {
            method: "POST",
            body: JSON.stringify({
              type: record.type,
              name: record.name,
              content: record.content,
              proxied: record.proxied ?? false,
              priority: record.priority,
              ttl: record.ttl ?? 1
            })
          }
        );
        return data.result;
      }
      async updateDnsRecord(zoneId, recordId, record) {
        const data = await this.request(
          `/zones/${zoneId}/dns_records/${recordId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              type: record.type,
              name: record.name,
              content: record.content,
              proxied: record.proxied ?? false,
              priority: record.priority,
              ttl: record.ttl ?? 1
            })
          }
        );
        return data.result;
      }
      async deleteDnsRecord(zoneId, recordId) {
        await this.request(`/zones/${zoneId}/dns_records/${recordId}`, {
          method: "DELETE"
        });
      }
      /** Match by type + normalized name; update if found, else create. */
      async upsertDnsRecord(zoneId, record) {
        const records = await this.listDnsRecords(zoneId, { type: record.type });
        const targetName = record.name.toLowerCase();
        const existing = records.find(
          (r) => r.type === record.type && r.name.toLowerCase() === targetName
        );
        if (existing) {
          return this.updateDnsRecord(zoneId, existing.id, record);
        }
        return this.createDnsRecord(zoneId, record);
      }
      async getEmailRoutingSettings(zoneId) {
        const data = await this.request(
          `/zones/${zoneId}/email/routing`
        );
        return { enabled: Boolean(data.result?.enabled) };
      }
      async enableEmailRouting(zoneId) {
        const data = await this.request(
          `/zones/${zoneId}/email/routing/enable`,
          { method: "POST" }
        );
        return { enabled: Boolean(data.result?.enabled) };
      }
      async listEmailRoutingRules(zoneId) {
        const data = await this.request(
          `/zones/${zoneId}/email/routing/rules`
        );
        return data.result ?? [];
      }
      async createEmailRoutingRule(zoneId, rule) {
        const data = await this.request(
          `/zones/${zoneId}/email/routing/rules`,
          {
            method: "POST",
            body: JSON.stringify(rule)
          }
        );
        return data.result;
      }
      async updateEmailRoutingRule(zoneId, ruleId, rule) {
        const data = await this.request(
          `/zones/${zoneId}/email/routing/rules/${ruleId}`,
          {
            method: "PUT",
            body: JSON.stringify(rule)
          }
        );
        return data.result;
      }
      async deleteEmailRoutingRule(zoneId, ruleId) {
        await this.request(
          `/zones/${zoneId}/email/routing/rules/${ruleId}`,
          { method: "DELETE" }
        );
      }
      async listSendingSubdomains(zoneId) {
        const data = await this.request(
          `/zones/${zoneId}/email/sending/subdomains`
        );
        return data.result ?? [];
      }
      /**
       * Onboard or create an Email Sending domain. Official docs only describe
       * the dashboard flow; this POST is the documented-adjacent list sibling.
       * Callers must treat 404/405 as "API not available — use the dashboard".
       */
      async createSendingSubdomain(zoneId, name) {
        const path = `/zones/${zoneId}/email/sending/subdomains`;
        const { res, data } = await this.requestOnce(path, {
          method: "POST",
          body: JSON.stringify({ name, enabled: true })
        });
        if (res.status === 404 || res.status === 405) {
          throw new SendingOnboardApiMissingError(res.status);
        }
        if (res.ok && data.success) return data.result;
        throw this.formatCfError(res, data, path, "POST");
      }
      async updateSendingSubdomain(zoneId, name, patch) {
        const path = `/zones/${zoneId}/email/sending/subdomains`;
        const { res, data } = await this.requestOnce(path, {
          method: "PATCH",
          body: JSON.stringify({ name, enabled: patch.enabled })
        });
        if (res.status === 404 || res.status === 405) {
          throw new SendingOnboardApiMissingError(res.status);
        }
        if (res.ok && data.success) return data.result;
        throw this.formatCfError(res, data, path, "PATCH");
      }
      /** Email Sending bounce MX on `cf-bounce.{domain}` — apex onboard signal. */
      async hasSendingBounceMx(zoneId, domain) {
        const name = `cf-bounce.${domain.trim().toLowerCase()}`;
        const records = await this.listDnsRecords(zoneId, { type: "MX", name });
        return records.some((record) => record.type === "MX");
      }
    };
    SendingOnboardApiMissingError = class extends Error {
      static {
        __name(this, "SendingOnboardApiMissingError");
      }
      status;
      constructor(status) {
        super(
          `Cloudflare Email Sending onboard API is not available (HTTP ${status}). Open Cloudflare \u2192 Email Service \u2192 Email Sending \u2192 Onboard Domain, then Recheck.`
        );
        this.name = "SendingOnboardApiMissingError";
        this.status = status;
      }
    };
  }
});

// src/lib/cloudflare-config.ts
async function readCloudflareRuntimeConfig(env) {
  const accountId = env.CF_ACCOUNT_ID?.trim() ?? "";
  const apiToken = env.CF_API_TOKEN?.trim() ?? "";
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}
async function createCloudflareClient(env) {
  const config = await readCloudflareRuntimeConfig(env);
  if (!config) {
    throw new Error(
      "Cloudflare API is not configured on this worker \u2014 add a CF_API_TOKEN secret (Email Sending + Email Routing + Zone Read) so the Worker can manage domains and DNS"
    );
  }
  return new CloudflareClient({
    accountId: config.accountId,
    apiToken: config.apiToken
  });
}
var init_cloudflare_config = __esm({
  "src/lib/cloudflare-config.ts"() {
    "use strict";
    init_cloudflare_client();
    __name(readCloudflareRuntimeConfig, "readCloudflareRuntimeConfig");
    __name(createCloudflareClient, "createCloudflareClient");
  }
});

// src/lib/email-send.ts
function emailBindingConfigured(env) {
  return typeof env.EMAIL?.send === "function";
}
function namedOrPlain(address, name) {
  const trimmed = name?.trim();
  return trimmed ? { email: address, name: trimmed } : address;
}
async function sendViaBinding(email, params) {
  const headers = {};
  const inReplyTo = params.inReplyTo?.trim();
  const references = params.references?.trim();
  if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
  if (references) headers.References = references;
  const payload = {
    from: namedOrPlain(params.from, params.fromName),
    to: params.to,
    subject: params.subject,
    text: params.text
  };
  if (params.cc) payload.cc = params.cc;
  const html = params.html?.trim();
  if (html) payload.html = html;
  const replyTo = params.replyTo?.trim();
  if (replyTo) payload.replyTo = replyTo;
  if (Object.keys(headers).length) payload.headers = headers;
  const result = await email.send(payload);
  return {
    messageId: result?.messageId?.trim() || `cf-email-${Date.now()}`,
    delivered: [],
    permanentBounces: [],
    queued: []
  };
}
async function sendOutboundEmail(env, params) {
  if (emailBindingConfigured(env) && env.EMAIL) {
    return sendViaBinding(env.EMAIL, params);
  }
  const cf = await createCloudflareClient(env);
  return cf.sendEmail(params);
}
var init_email_send = __esm({
  "src/lib/email-send.ts"() {
    "use strict";
    init_cloudflare_client();
    init_cloudflare_config();
    __name(emailBindingConfigured, "emailBindingConfigured");
    __name(namedOrPlain, "namedOrPlain");
    __name(sendViaBinding, "sendViaBinding");
    __name(sendOutboundEmail, "sendOutboundEmail");
  }
});

// src/lib/ops-logs.ts
function logId() {
  return crypto.randomUUID();
}
function logAt() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
async function recordOpsLog(db, input) {
  if (!db) return null;
  const entry = {
    id: input.id ?? logId(),
    at: input.at ?? logAt(),
    kind: input.kind,
    ok: input.ok,
    status: input.status ?? null,
    source: input.source ?? null,
    domain: input.domain ?? null,
    fromAddr: input.fromAddr ?? null,
    toAddr: input.toAddr ?? null,
    subject: input.subject ?? null,
    messageId: input.messageId ?? null,
    error: input.error ?? null,
    keyId: input.keyId ?? null,
    keyPrefix: input.keyPrefix ?? null,
    metaJson: input.metaJson ?? null
  };
  try {
    await db.prepare(
      `INSERT INTO ops_log (
          id, at, kind, ok, status, source, domain,
          from_addr, to_addr, subject, message_id, error,
          key_id, key_prefix, meta_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      entry.id,
      entry.at,
      entry.kind,
      entry.ok ? 1 : 0,
      entry.status,
      entry.source,
      entry.domain,
      entry.fromAddr,
      entry.toAddr,
      entry.subject,
      entry.messageId,
      entry.error,
      entry.keyId,
      entry.keyPrefix,
      entry.metaJson
    ).run();
    return entry;
  } catch (error) {
    console.error("Failed to record ops log", error);
    return null;
  }
}
async function listOpsLogs(db, filters = {}) {
  if (!db) {
    return { logs: [], summary: { total: 0, failed: 0, failedLast24h: 0 } };
  }
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const status = filters.status ?? "all";
  const domain = filters.domain?.trim().toLowerCase();
  const kind = filters.kind;
  const conditions = [];
  const params = [];
  if (status === "failed") {
    conditions.push("ok = 0");
  } else if (status === "success") {
    conditions.push("ok = 1");
  }
  if (domain) {
    conditions.push("LOWER(domain) = ?");
    params.push(domain);
  }
  if (kind) {
    conditions.push("kind = ?");
    params.push(kind);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  try {
    const { results } = await db.prepare(
      `SELECT
          id, at, kind, ok, status, source, domain,
          from_addr AS fromAddr, to_addr AS toAddr, subject,
          message_id AS messageId, error, key_id AS keyId,
          key_prefix AS keyPrefix, meta_json AS metaJson
        FROM ops_log
        ${where}
        ORDER BY at DESC
        LIMIT ?`
    ).bind(...params, limit).all();
    const { results: summaryRows } = await db.prepare(
      `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN ok = 0 AND at >= ? THEN 1 ELSE 0 END) AS failedLast24h
        FROM ops_log`
    ).bind(new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString()).all();
    const summary = summaryRows?.[0] ?? {
      total: 0,
      failed: 0,
      failedLast24h: 0
    };
    return {
      logs: results ?? [],
      summary: {
        total: Number(summary.total) || 0,
        failed: Number(summary.failed) || 0,
        failedLast24h: Number(summary.failedLast24h) || 0
      }
    };
  } catch (error) {
    console.error("Failed to list ops logs", error);
    return { logs: [], summary: { total: 0, failed: 0, failedLast24h: 0 } };
  }
}
var init_ops_logs = __esm({
  "src/lib/ops-logs.ts"() {
    "use strict";
    __name(logId, "logId");
    __name(logAt, "logAt");
    __name(recordOpsLog, "recordOpsLog");
    __name(listOpsLogs, "listOpsLogs");
  }
});

// src/lib/send-logs.ts
function logKey(id) {
  return `${SENDLOG_PREFIX}${id}.json`;
}
async function readJson(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}
function isSendLogKey(key) {
  return key.startsWith(SENDLOG_PREFIX) && key.endsWith(".json") && key !== `${SENDLOG_PREFIX}_index.json`;
}
function idFromKey(key) {
  const base = key.slice(SENDLOG_PREFIX.length).replace(/\.json$/, "");
  return base;
}
async function recordSendLog(bucket, entry) {
  const id = entry.id ?? crypto.randomUUID();
  const at = entry.at ?? (/* @__PURE__ */ new Date()).toISOString();
  const record = { ...entry, id, at };
  await bucket.put(logKey(id), JSON.stringify(record), JSON_META);
  return record;
}
function matchesFilters(log, filters) {
  if (filters.status === "failed" && log.ok) return false;
  if (filters.status === "success" && !log.ok) return false;
  if (filters.domain) {
    const needle = filters.domain.trim().toLowerCase();
    if (!needle) return true;
    if (!log.domain?.toLowerCase().includes(needle)) return false;
  }
  return true;
}
function summarize(logs) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1e3;
  let failed = 0;
  let failedLast24h = 0;
  for (const log of logs) {
    if (log.ok) continue;
    failed += 1;
    if (new Date(log.at).getTime() >= cutoff) {
      failedLast24h += 1;
    }
  }
  return { total: logs.length, failed, failedLast24h };
}
async function listSendLogs(bucket, filters = {}) {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), MAX_LOGS);
  const listed = [];
  let cursor;
  do {
    const page = await bucket.list({
      prefix: SENDLOG_PREFIX,
      limit: 1e3,
      cursor
    });
    for (const object of page.objects) {
      if (!isSendLogKey(object.key)) continue;
      const id = idFromKey(object.key);
      const log = await readJson(bucket, object.key);
      if (!log) continue;
      if (!log.id) log.id = id;
      listed.push(log);
    }
    cursor = page.truncated ? page.cursor : void 0;
    if (listed.length >= MAX_LOGS) break;
  } while (cursor);
  listed.sort((a, b) => b.at.localeCompare(a.at));
  const filtered = listed.filter((log) => matchesFilters(log, filters));
  const logs = filtered.slice(0, limit);
  return { logs, summary: summarize(listed) };
}
var MAX_LOGS, SENDLOG_PREFIX, JSON_META;
var init_send_logs = __esm({
  "src/lib/send-logs.ts"() {
    "use strict";
    MAX_LOGS = 500;
    SENDLOG_PREFIX = "sent/_sendlog/";
    __name(logKey, "logKey");
    JSON_META = { httpMetadata: { contentType: "application/json" } };
    __name(readJson, "readJson");
    __name(isSendLogKey, "isSendLogKey");
    __name(idFromKey, "idFromKey");
    __name(recordSendLog, "recordSendLog");
    __name(matchesFilters, "matchesFilters");
    __name(summarize, "summarize");
    __name(listSendLogs, "listSendLogs");
  }
});

// src/lib/catalog-broadcasts.ts
var catalog_broadcasts_exports = {};
__export(catalog_broadcasts_exports, {
  createBroadcastDraft: () => createBroadcastDraft,
  deleteBroadcast: () => deleteBroadcast,
  getBroadcastDetail: () => getBroadcastDetail,
  getBroadcastProgress: () => getBroadcastProgress,
  readBroadcasts: () => readBroadcasts,
  sendBroadcast: () => sendBroadcast,
  updateBroadcastDraft: () => updateBroadcastDraft2,
  updateBroadcastGroupIds: () => updateBroadcastGroupIds,
  writeBroadcasts: () => writeBroadcasts
});
function plainTextToEmailHtml(text2) {
  const escaped = text2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const withBreaks = escaped.replace(/\n/g, "<br>\n");
  return `<div style="font-family:sans-serif;white-space:pre-wrap">${withBreaks}</div>`;
}
async function readBroadcasts(db) {
  return listBroadcasts(db);
}
async function writeBroadcasts(_db, _broadcasts) {
}
function normalizeFromAddress(from) {
  const trimmed = from?.trim().toLowerCase();
  return trimmed && trimmed.includes("@") ? trimmed : null;
}
function resolveBroadcastGroups(catalog, groupIds) {
  const wanted = new Set(groupIds);
  return catalog.groups.filter((g) => wanted.has(g.id));
}
function summarizeGroup(catalog, group) {
  return {
    ...group,
    contactCount: catalog.contacts.filter((c) => c.groupId === group.id).length
  };
}
function resolveDefaultFrom(mailboxAddresses, groups) {
  for (const group of groups) {
    if (group.defaultFrom) {
      const match2 = mailboxAddresses.find(
        (a) => a.email.toLowerCase() === group.defaultFrom.toLowerCase()
      );
      if (match2) return match2.email.toLowerCase();
    }
  }
  const domain = groups[0]?.domain;
  if (!domain) return null;
  const onDomain = mailboxAddresses.find(
    (a) => a.email.toLowerCase().endsWith(`@${domain}`)
  );
  return onDomain?.email.toLowerCase() ?? null;
}
async function getBroadcastDetail(db, broadcastId) {
  const [broadcast, catalog] = await Promise.all([
    getBroadcast(db, broadcastId),
    readAudienceCatalog(db)
  ]);
  if (!broadcast) return null;
  const groups = resolveBroadcastGroups(catalog, broadcast.groupIds).map(
    (g) => summarizeGroup(catalog, g)
  );
  const recipientCount = (await listContactsForGroupsFromDb(db, broadcast.groupIds)).length;
  return { broadcast, groups, recipientCount };
}
async function createBroadcastDraft(db, input) {
  const groupIds = Array.from(new Set(input.groupIds.filter(Boolean)));
  if (groupIds.length === 0) {
    throw new Error("Select at least one audience group");
  }
  const [catalog, mailbox] = await Promise.all([
    readAudienceCatalog(db),
    readMailbox2(db)
  ]);
  const groups = resolveBroadcastGroups(catalog, groupIds);
  if (groups.length === 0) {
    throw new Error("Audience group(s) not found");
  }
  const from = normalizeFromAddress(input.from) || resolveDefaultFrom(mailbox.addresses, groups);
  const domain = from?.split("@")[1]?.toLowerCase() || groups[0].domain;
  const subject = input.subject?.trim() || "";
  const body = input.body != null ? input.body : "";
  const recipientCount = (await listContactsForGroupsFromDb(db, groupIds)).length;
  const clientId = input.id?.trim();
  if (clientId) {
    const existing = await getBroadcast(db, clientId);
    if (existing) {
      if (existing.status === "sending" || existing.status === "sent") {
        throw new Error("Broadcast was already sent");
      }
      await updateBroadcastDraft(db, clientId, {
        subject,
        body,
        groupIds,
        from: from ?? null
      });
      const updated = await getBroadcast(db, clientId);
      return updated;
    }
  }
  const id = clientId || crypto.randomUUID();
  await createBroadcastRow(db, { id, subject, domain, groupIds });
  if (from || body) {
    await updateBroadcastDraft(db, id, {
      ...from ? { from } : {},
      ...body ? { body } : {}
    });
  }
  const broadcast = await getBroadcast(db, id);
  return broadcast;
}
async function updateBroadcastDraft2(db, broadcastId, patch) {
  const [current, catalog] = await Promise.all([
    getBroadcast(db, broadcastId),
    readAudienceCatalog(db)
  ]);
  if (!current) throw new Error("Broadcast not found");
  if (current.status === "sending") {
    throw new Error("Broadcast is sending and cannot be edited");
  }
  if (current.status === "sent") {
    throw new Error("Only draft broadcasts can be edited");
  }
  if (current.status !== "draft" && current.status !== "failed") {
    throw new Error("Only draft broadcasts can be edited");
  }
  let groupIds = current.groupIds;
  if (patch.groupIds !== void 0) {
    groupIds = Array.from(new Set(patch.groupIds.filter(Boolean)));
    if (groupIds.length === 0) {
      throw new Error("Select at least one audience group");
    }
    if (resolveBroadcastGroups(catalog, groupIds).length === 0) {
      throw new Error("Audience group(s) not found");
    }
  }
  const from = patch.from === void 0 ? current.from : normalizeFromAddress(patch.from) ?? void 0;
  const subject = patch.subject !== void 0 ? patch.subject : current.subject;
  const body = patch.body !== void 0 ? patch.body : current.body;
  const domain = from?.split("@")[1]?.toLowerCase() || resolveBroadcastGroups(catalog, groupIds)[0]?.domain || current.domain;
  const recipientCount = (await listContactsForGroupsFromDb(db, groupIds)).length;
  await updateBroadcastDraft(db, broadcastId, {
    subject,
    body,
    groupIds,
    from: from ?? null
  });
  const updated = await getBroadcast(db, broadcastId);
  return {
    ...updated,
    domain,
    recipientCount
  };
}
async function sendBroadcast(env, broadcastId, options = {}) {
  const db = createAppDbFromEnv(env);
  const [current, catalog, mailbox] = await Promise.all([
    getBroadcast(db, broadcastId),
    readAudienceCatalog(db),
    readMailbox2(db)
  ]);
  if (!current) throw new Error("Broadcast not found");
  if (current.status === "sending") {
    throw new Error("Broadcast is already sending");
  }
  if (current.status === "sent") {
    throw new Error("Broadcast was already sent");
  }
  if (current.status !== "draft" && current.status !== "failed") {
    throw new Error("Only draft broadcasts can be sent");
  }
  if (!current.subject?.trim()) {
    throw new Error("Add a subject before broadcasting");
  }
  if (current.groupIds.length === 0) {
    throw new Error("Select at least one audience group");
  }
  const groups = resolveBroadcastGroups(catalog, current.groupIds);
  const from = normalizeFromAddress(options.from) || normalizeFromAddress(current.from) || resolveDefaultFrom(mailbox.addresses, groups);
  if (!from) {
    throw new Error("Choose a From address before broadcasting");
  }
  const knownAddress = mailbox.addresses.find(
    (a) => a.email.toLowerCase() === from
  );
  if (!knownAddress) {
    throw new Error("From address is not a registered sender");
  }
  const domain = from.split("@")[1]?.toLowerCase() || current.domain || groups[0]?.domain || "";
  const fromName = knownAddress.displayName?.trim() || void 0;
  const subject = current.subject.trim();
  const text2 = current.body?.trim() ?? "";
  const html = plainTextToEmailHtml(text2);
  const recipients = await listContactsForGroupsFromDb(db, current.groupIds);
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const run = {
    id: crypto.randomUUID(),
    status: "running",
    phase: "preparing",
    startedAt,
    totalCount: recipients.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0
  };
  await updateBroadcastDraft(db, broadcastId, {
    from,
    subject,
    body: text2
  });
  await updateBroadcastSendProgress(db, broadcastId, run);
  try {
    if (recipients.length === 0) {
      throw new Error("No recipients in the selected audience groups");
    }
    run.phase = "sending";
    await updateBroadcastSendProgress(db, broadcastId, run);
    let successCount = 0;
    let failedCount = 0;
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      try {
        const result = await sendOutboundEmail(env, {
          from,
          fromName,
          to: recipient.email,
          subject,
          text: text2,
          html
        });
        await recordSendLog(env.INBOUND, {
          ok: true,
          status: 200,
          domain,
          keyId: null,
          keyPrefix: null,
          keyLabel: "broadcast",
          from,
          to: recipient.email,
          subject,
          messageId: result.messageId
        });
        await recordOpsLog(env.RELAYBASE_LOGS, {
          kind: "send",
          ok: true,
          status: 200,
          source: "broadcast",
          domain,
          fromAddr: from,
          toAddr: recipient.email,
          subject,
          messageId: result.messageId
        });
        successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send";
        await recordSendLog(env.INBOUND, {
          ok: false,
          status: 502,
          domain,
          keyId: null,
          keyPrefix: null,
          keyLabel: "broadcast",
          from,
          to: recipient.email,
          subject,
          error: message
        });
        await recordOpsLog(env.RELAYBASE_LOGS, {
          kind: "send",
          ok: false,
          status: 502,
          source: "broadcast",
          domain,
          fromAddr: from,
          toAddr: recipient.email,
          subject,
          error: message
        });
        if (isCloudflarePlanError(message)) {
          const finishedAt2 = (/* @__PURE__ */ new Date()).toISOString();
          run.phase = "done";
          run.status = "error";
          run.finishedAt = finishedAt2;
          run.error = message;
          run.estimatedRemainingMs = 0;
          run.processedCount = i + 1;
          run.failedCount = failedCount + 1;
          await finishBroadcastSend(db, broadcastId, {
            status: "failed",
            run: { ...run },
            recipientCount: recipients.length,
            from
          });
          throw error instanceof Error ? error : new Error(message);
        }
        failedCount++;
      }
      run.processedCount = i + 1;
      run.successCount = successCount;
      run.failedCount = failedCount;
      if ((i + 1) % 5 === 0 || i === recipients.length - 1) {
        await updateBroadcastSendProgress(db, broadcastId, run);
      }
    }
    const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    run.phase = "done";
    run.finishedAt = finishedAt;
    run.estimatedRemainingMs = 0;
    let finalStatus;
    if (successCount === 0) {
      run.status = "error";
      run.error = "All recipients failed";
      finalStatus = "failed";
    } else {
      run.status = "success";
      finalStatus = "sent";
      if (failedCount > 0) {
        run.error = `${failedCount} of ${recipients.length} failed`;
      }
    }
    await finishBroadcastSend(db, broadcastId, {
      status: finalStatus,
      run: { ...run },
      recipientCount: recipients.length,
      from
    });
    return await getBroadcast(db, broadcastId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Broadcast failed";
    const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    run.phase = "done";
    run.status = "error";
    run.finishedAt = finishedAt;
    run.error = message;
    run.estimatedRemainingMs = 0;
    await finishBroadcastSend(db, broadcastId, {
      status: "failed",
      run: { ...run },
      recipientCount: recipients.length,
      from
    });
    throw e;
  }
}
function getBroadcastProgress(broadcast) {
  return {
    broadcastId: broadcast.id,
    status: broadcast.status,
    progress: broadcast.sendProgress ?? null,
    history: broadcast.sendHistory ?? []
  };
}
async function deleteBroadcast(db, id) {
  return deleteBroadcastRow(db, id);
}
function createAppDbFromEnv(env) {
  return createAppDb(env.RELAYBASE_DB);
}
var init_catalog_broadcasts = __esm({
  "src/lib/catalog-broadcasts.ts"() {
    "use strict";
    init_app();
    init_broadcasts();
    init_catalog_audience();
    init_email_send();
    init_cloudflare_api_hints();
    init_catalog_store();
    init_ops_logs();
    init_send_logs();
    init_broadcasts();
    __name(plainTextToEmailHtml, "plainTextToEmailHtml");
    __name(readBroadcasts, "readBroadcasts");
    __name(writeBroadcasts, "writeBroadcasts");
    __name(normalizeFromAddress, "normalizeFromAddress");
    __name(resolveBroadcastGroups, "resolveBroadcastGroups");
    __name(summarizeGroup, "summarizeGroup");
    __name(resolveDefaultFrom, "resolveDefaultFrom");
    __name(getBroadcastDetail, "getBroadcastDetail");
    __name(createBroadcastDraft, "createBroadcastDraft");
    __name(updateBroadcastDraft2, "updateBroadcastDraft");
    __name(sendBroadcast, "sendBroadcast");
    __name(getBroadcastProgress, "getBroadcastProgress");
    __name(deleteBroadcast, "deleteBroadcast");
    __name(createAppDbFromEnv, "createAppDbFromEnv");
  }
});

// src/lib/catalog-audience.ts
async function readAudienceCatalog(db) {
  const [groups, contacts] = await Promise.all([
    listGroups(db),
    listContacts(db)
  ]);
  return { contacts, groups };
}
function listGroupSummaries(catalog) {
  return catalog.groups.map((group) => ({
    ...group,
    contactCount: catalog.contacts.filter((c) => c.groupId === group.id).length
  }));
}
function getGroupDetail2(catalog, groupId) {
  const group = catalog.groups.find((g) => g.id === groupId);
  if (!group) return null;
  return {
    group: {
      ...group,
      contactCount: catalog.contacts.filter((c) => c.groupId === group.id).length
    },
    contacts: catalog.contacts.filter((c) => c.groupId === groupId)
  };
}
function mergeDataSource2(previous, patch) {
  return mergeDataSource(previous, patch);
}
function parseCredentialHeaderValue(dataSource) {
  const credential = dataSource.credential?.trim();
  if (!credential) return null;
  const header = dataSource.credentialHeader?.trim() || "Authorization";
  if (header.toLowerCase() === "authorization") {
    const value = credential.toLowerCase().startsWith("bearer ") ? credential : `Bearer ${credential}`;
    return { header: "Authorization", value };
  }
  return { header, value: credential };
}
function extractRawContactList(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  const obj = json;
  for (const key of ["contacts", "data", "items", "results"]) {
    if (Array.isArray(obj[key])) return obj[key];
  }
  return [];
}
function emailLocalPart(email) {
  return email.split("@")[0] || email;
}
async function fetchDataSourceContacts(dataSource) {
  const auth = parseCredentialHeaderValue(dataSource);
  const headers = auth ? { [auth.header]: auth.value } : {};
  const res = await fetch(dataSource.endpointUrl, { headers });
  if (!res.ok) {
    throw new Error(`Endpoint returned ${res.status} ${res.statusText}`);
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("Endpoint did not return valid JSON");
  }
  const rawList = extractRawContactList(json);
  let skippedCount = 0;
  const contacts = [];
  for (const entry of rawList) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      skippedCount++;
      continue;
    }
    const record = entry;
    const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      skippedCount++;
      continue;
    }
    const explicitName = typeof record.name === "string" && record.name.trim() ? record.name.trim() : void 0;
    contacts.push({ email, name: explicitName || emailLocalPart(email) });
  }
  return { contacts, skippedCount };
}
function estimateRemainingMs(startedAt, processed, total) {
  if (processed <= 0 || total <= 0 || processed >= total) return void 0;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed <= 0) return void 0;
  const rate = processed / elapsed;
  if (rate <= 0) return void 0;
  return Math.round((total - processed) / rate);
}
async function syncAudienceGroup(db, groupId, options = {}) {
  const group = await getGroup(db, groupId);
  if (!group) throw new Error("Audience group not found");
  if (!group.dataSource) throw new Error("Audience group has no data source");
  const trigger = options.trigger ?? "manual";
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const run = {
    id: crypto.randomUUID(),
    trigger,
    status: "running",
    phase: "fetching",
    startedAt,
    processedCount: 0,
    totalCount: 0
  };
  await updateSyncProgress(db, groupId, run);
  try {
    const { contacts, skippedCount } = await fetchDataSourceContacts(
      group.dataSource
    );
    run.phase = "parsing";
    run.totalCount = contacts.length;
    run.skippedCount = skippedCount;
    run.failedCount = skippedCount;
    await updateSyncProgress(db, groupId, run);
    run.phase = "writing";
    run.processedCount = 0;
    await updateSyncProgress(db, groupId, run);
    for (let i = 0; i < contacts.length; i += SYNC_WRITE_CHUNK) {
      run.processedCount = Math.min(i + SYNC_WRITE_CHUNK, contacts.length);
      run.estimatedRemainingMs = estimateRemainingMs(
        startedAt,
        run.processedCount,
        contacts.length
      );
      await updateSyncProgress(db, groupId, run);
    }
    const count3 = await replaceSyncedContacts(
      db,
      groupId,
      group.domain,
      contacts
    );
    const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    run.phase = "done";
    run.status = "success";
    run.finishedAt = finishedAt;
    run.processedCount = count3;
    run.successCount = count3;
    run.estimatedRemainingMs = 0;
    await finishSync(db, groupId, {
      run: { ...run },
      lastSyncAt: finishedAt,
      lastSyncStatus: "success",
      lastSyncCount: count3
    });
    return { ok: true, count: count3, skippedCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    run.phase = "done";
    run.status = "error";
    run.finishedAt = finishedAt;
    run.error = message;
    run.estimatedRemainingMs = 0;
    await finishSync(db, groupId, {
      run: { ...run },
      lastSyncAt: finishedAt,
      lastSyncStatus: "error",
      lastSyncError: message,
      lastSyncCount: 0
    });
    return { ok: false, count: 0, skippedCount: 0, error: message };
  }
}
async function createAudienceGroup(db, input) {
  const name = input.name.trim();
  const domain = normalizeDomain2(input.domain);
  if (!name) throw new Error("name is required");
  if (!domain) throw new Error("domain is required");
  const group = await createGroup(db, {
    name,
    domain,
    dataSource: input.dataSource,
    cronEnabled: input.cronEnabled,
    cronIntervalMinutes: input.cronIntervalMinutes
  });
  if (group.dataSource) {
    await syncAudienceGroup(db, group.id, { trigger: "manual" });
    return await getGroup(db, group.id) ?? group;
  }
  return group;
}
async function updateAudienceGroup(db, groupId, patch) {
  return updateGroup(db, groupId, patch);
}
async function deleteAudienceGroup(db, groupId) {
  await deleteGroup(db, groupId);
  const { readBroadcasts: readBroadcasts2, updateBroadcastGroupIds: updateBroadcastGroupIds2 } = await Promise.resolve().then(() => (init_catalog_broadcasts(), catalog_broadcasts_exports));
  const broadcasts2 = await readBroadcasts2(db);
  for (const b of broadcasts2) {
    const next = b.groupIds.filter((id) => id !== groupId);
    if (next.length !== b.groupIds.length) {
      await updateBroadcastGroupIds2(db, b.id, next);
    }
  }
}
async function addManualContact2(db, groupId, input) {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }
  const group = await getGroup(db, groupId);
  if (!group) throw new Error("Audience group not found");
  return addManualContact(db, {
    email,
    name: input.name,
    groupId,
    domain: group.domain
  });
}
async function removeContact2(db, groupId, contactId) {
  await removeContact(db, contactId);
}
async function listContactsForGroupsFromDb(db, groupIds) {
  const contacts = await listContactsForGroups(db, groupIds);
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const contact of contacts) {
    if (seen.has(contact.email)) continue;
    seen.add(contact.email);
    result.push(contact);
  }
  return result;
}
function getGroupProgress(catalog, groupId) {
  const group = catalog.groups.find((g) => g.id === groupId);
  if (!group) return null;
  let nextDueAt = null;
  if (group.cronEnabled && group.cronIntervalMinutes && group.cronIntervalMinutes > 0) {
    if (group.lastSyncAt) {
      nextDueAt = new Date(
        new Date(group.lastSyncAt).getTime() + group.cronIntervalMinutes * 6e4
      ).toISOString();
    } else {
      nextDueAt = (/* @__PURE__ */ new Date()).toISOString();
    }
  }
  return {
    groupId,
    cronEnabled: Boolean(group.cronEnabled),
    cronIntervalMinutes: group.cronIntervalMinutes,
    nextDueAt,
    lastSyncAt: group.lastSyncAt,
    progress: group.syncProgress ?? null,
    history: group.syncHistory ?? []
  };
}
function isDue(group, now) {
  if (!group.cronEnabled || !group.dataSource) return false;
  const interval = group.cronIntervalMinutes ?? 0;
  if (interval <= 0) return false;
  if (!group.lastSyncAt) return true;
  const elapsed = now - new Date(group.lastSyncAt).getTime();
  return elapsed >= interval * 6e4 - DUE_GRACE_MS;
}
async function runAudienceCron(db) {
  const groups = await listGroupsForCron(db);
  const now = Date.now();
  const due = groups.filter((g) => isDue(g, now));
  let groupsSynced = 0;
  for (const group of due) {
    try {
      await syncAudienceGroup(db, group.id, { trigger: "cron" });
      groupsSynced++;
    } catch (error) {
      console.error("Audience cron sync failed", group.id, error);
    }
  }
  return { groupsSynced };
}
var SYNC_WRITE_CHUNK, DUE_GRACE_MS;
var init_catalog_audience = __esm({
  "src/lib/catalog-audience.ts"() {
    "use strict";
    init_audience();
    init_catalog_store();
    SYNC_WRITE_CHUNK = 50;
    DUE_GRACE_MS = 6e4;
    __name(readAudienceCatalog, "readAudienceCatalog");
    __name(listGroupSummaries, "listGroupSummaries");
    __name(getGroupDetail2, "getGroupDetail");
    __name(mergeDataSource2, "mergeDataSource");
    __name(parseCredentialHeaderValue, "parseCredentialHeaderValue");
    __name(extractRawContactList, "extractRawContactList");
    __name(emailLocalPart, "emailLocalPart");
    __name(fetchDataSourceContacts, "fetchDataSourceContacts");
    __name(estimateRemainingMs, "estimateRemainingMs");
    __name(syncAudienceGroup, "syncAudienceGroup");
    __name(createAudienceGroup, "createAudienceGroup");
    __name(updateAudienceGroup, "updateAudienceGroup");
    __name(deleteAudienceGroup, "deleteAudienceGroup");
    __name(addManualContact2, "addManualContact");
    __name(removeContact2, "removeContact");
    __name(listContactsForGroupsFromDb, "listContactsForGroupsFromDb");
    __name(getGroupProgress, "getGroupProgress");
    __name(isDue, "isDue");
    __name(runAudienceCron, "runAudienceCron");
  }
});

// db/mail/messages.ts
var messages_exports = {};
__export(messages_exports, {
  deleteMailboxMessages: () => deleteMailboxMessages,
  encodeMailboxCursor: () => encodeMailboxCursor,
  listMailboxPage: () => listMailboxPage,
  mailboxAddressCounts: () => mailboxAddressCounts,
  mailboxCounts: () => mailboxCounts,
  mailboxFreshness: () => mailboxFreshness,
  mailboxIdsForDomain: () => mailboxIdsForDomain,
  mailboxPruneIds: () => mailboxPruneIds,
  parseMailboxCursor: () => parseMailboxCursor,
  recipientsColumn: () => recipientsColumn,
  updateMailboxReadState: () => updateMailboxReadState,
  upsertMailboxMessage: () => upsertMailboxMessage
});
function parseMailboxCursor(before) {
  const raw2 = before?.trim();
  if (!raw2) return null;
  const sep = raw2.lastIndexOf("|");
  if (sep <= 0) return { occurredAt: raw2, id: null };
  return { occurredAt: raw2.slice(0, sep), id: raw2.slice(sep + 1) || null };
}
function encodeMailboxCursor(row) {
  return `${row.occurred_at}|${row.id}`;
}
function recipientsColumn(input) {
  const addresses2 = /* @__PURE__ */ new Set();
  const add = /* @__PURE__ */ __name((value) => {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) addresses2.add(trimmed);
  }, "add");
  add(input.toEmail);
  for (const to of input.toEmails ?? []) add(to);
  for (const cc of input.ccEmails ?? []) add(cc);
  return [...addresses2].join(",");
}
async function upsertMailboxMessage(db, input) {
  if (!db) return;
  const recipients = input.recipients ?? recipientsColumn({
    toEmail: input.to_email,
    toEmails: input.to_emails ? splitAddressList(input.to_emails) : void 0,
    ccEmails: input.cc_emails ? splitAddressList(input.cc_emails) : void 0
  });
  await db.run(sql`
    INSERT INTO mailbox_messages (
      id, kind, domain, from_email, from_name, to_email, to_emails,
      cc_emails, recipients, subject, body_preview, occurred_at,
      message_id, in_reply_to, refs, size, attachment_count, read_at, r2_prefix
    ) VALUES (
      ${input.id}, ${input.kind}, ${input.domain}, ${input.from_email},
      ${input.from_name}, ${input.to_email}, ${input.to_emails},
      ${input.cc_emails}, ${recipients}, ${input.subject},
      ${input.body_preview}, ${input.occurred_at}, ${input.message_id},
      ${input.in_reply_to}, ${input.refs}, ${input.size},
      ${input.attachment_count}, ${input.read_at}, ${input.r2_prefix}
    )
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      domain = excluded.domain,
      from_email = excluded.from_email,
      from_name = excluded.from_name,
      to_email = excluded.to_email,
      to_emails = excluded.to_emails,
      cc_emails = excluded.cc_emails,
      recipients = excluded.recipients,
      subject = excluded.subject,
      body_preview = excluded.body_preview,
      occurred_at = excluded.occurred_at,
      message_id = excluded.message_id,
      in_reply_to = excluded.in_reply_to,
      refs = excluded.refs,
      size = excluded.size,
      attachment_count = excluded.attachment_count,
      read_at = excluded.read_at,
      r2_prefix = excluded.r2_prefix
  `);
}
async function deleteMailboxMessages(db, ids) {
  if (!db || ids.length === 0) return;
  for (const id of ids) {
    await db.run(sql`DELETE FROM mailbox_messages WHERE id = ${id}`);
  }
}
async function updateMailboxReadState(db, ids, readAt) {
  if (!db || ids.length === 0) return;
  for (const id of ids) {
    await db.run(
      sql`UPDATE mailbox_messages SET read_at = ${readAt} WHERE id = ${id} AND kind = 'inbound'`
    );
  }
}
function splitAddressList(value) {
  if (!value) return [];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}
async function mailboxIdsForDomain(db, kind, domain) {
  const ids = /* @__PURE__ */ new Set();
  if (!db) return ids;
  const raw2 = db.$client;
  const rows = await raw2.prepare(`SELECT id FROM mailbox_messages WHERE kind = ? AND domain = ?`).bind(kind, domain).all();
  for (const row of rows.results ?? []) {
    if (row.id) ids.add(row.id);
  }
  return ids;
}
async function mailboxCounts(db, kind, domain) {
  if (!db) return { total: 0, unread: 0 };
  const raw2 = db.$client;
  const [totalRow, unreadRow] = await Promise.all([
    raw2.prepare(
      `SELECT COUNT(*) AS total FROM mailbox_messages WHERE kind = ? AND domain = ?`
    ).bind(kind, domain).first(),
    kind === "inbound" ? raw2.prepare(
      `SELECT COUNT(*) AS total FROM mailbox_messages
             WHERE kind = 'inbound' AND domain = ? AND read_at IS NULL`
    ).bind(domain).first() : Promise.resolve({ total: 0 })
  ]);
  return {
    total: Number(totalRow?.total ?? 0),
    unread: Number(unreadRow?.total ?? 0)
  };
}
async function mailboxAddressCounts(db, kind, domain) {
  if (!db) return {};
  const raw2 = db.$client;
  const rows = await raw2.prepare(
    `SELECT recipients, read_at FROM mailbox_messages
       WHERE kind = ? AND domain = ?`
  ).bind(kind, domain).all();
  const out = {};
  for (const row of rows.results ?? []) {
    const addresses2 = (row.recipients ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
    const unread = kind === "inbound" && !row.read_at;
    for (const address of addresses2) {
      const bucket = out[address] ?? { total: 0, unread: 0 };
      bucket.total += 1;
      if (unread) bucket.unread += 1;
      out[address] = bucket;
    }
  }
  return out;
}
async function mailboxFreshness(db) {
  if (!db) return [];
  const raw2 = db.$client;
  const rows = await raw2.prepare(
    `SELECT kind, domain, MAX(occurred_at) AS last_at, COUNT(*) AS count
       FROM mailbox_messages GROUP BY kind, domain`
  ).all();
  return rows.results ?? [];
}
async function listMailboxPage(db, filters) {
  if (!db) {
    return { rows: [], nextBefore: null, hasMore: false, total: 0, unread: 0 };
  }
  const domain = filters.domain.trim().toLowerCase();
  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const cursor = parseMailboxCursor(filters.before);
  const account = filters.account?.trim().toLowerCase() || null;
  const raw2 = db.$client;
  const conditions = ["kind = ?", "domain = ?"];
  const params = [filters.kind, domain];
  if (account) {
    conditions.push("(',' || recipients || ',') LIKE ?");
    params.push(`%,${account},%`);
  }
  if (cursor) {
    if (cursor.id) {
      conditions.push(
        "(occurred_at < ? OR (occurred_at = ? AND id < ?))"
      );
      params.push(cursor.occurredAt, cursor.occurredAt, cursor.id);
    } else {
      conditions.push("occurred_at < ?");
      params.push(cursor.occurredAt);
    }
  }
  const where = conditions.join(" AND ");
  const pageSql = `SELECT id, kind, domain, from_email, from_name, to_email, to_emails,
      cc_emails, recipients, subject, body_preview, occurred_at, message_id,
      in_reply_to, refs, size, attachment_count, read_at, r2_prefix
    FROM mailbox_messages
    WHERE ${where}
    ORDER BY occurred_at DESC, id DESC
    LIMIT ?`;
  const pageParams = [...params, limit + 1];
  const countSql = `SELECT COUNT(*) AS total FROM mailbox_messages WHERE kind = ? AND domain = ?${account ? " AND (',' || recipients || ',') LIKE ?" : ""}`;
  const countParams = [filters.kind, domain];
  if (account) countParams.push(`%,${account},%`);
  const unreadSql = filters.kind === "inbound" ? `SELECT COUNT(*) AS total FROM mailbox_messages
         WHERE kind = 'inbound' AND domain = ? AND read_at IS NULL${account ? " AND (',' || recipients || ',') LIKE ?" : ""}` : null;
  const unreadParams = [domain];
  if (account && unreadSql) unreadParams.push(`%,${account},%`);
  const [pageResult, countResult, unreadResult] = await Promise.all([
    raw2.prepare(pageSql).bind(...pageParams).all(),
    raw2.prepare(countSql).bind(...countParams).first(),
    unreadSql ? raw2.prepare(unreadSql).bind(...unreadParams).first() : Promise.resolve({ total: 0 })
  ]);
  const rows = pageResult.results ?? [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    rows: page,
    nextBefore: hasMore && last ? encodeMailboxCursor(last) : null,
    hasMore,
    total: Number(countResult?.total ?? 0),
    unread: Number(unreadResult?.total ?? 0)
  };
}
async function mailboxPruneIds(db, kind, domain, keep, limit) {
  if (!db || keep <= 0) return [];
  const raw2 = db.$client;
  if (limit != null && limit > 0) {
    const rows2 = await raw2.prepare(
      `SELECT id FROM mailbox_messages
         WHERE kind = ? AND domain = ?
         ORDER BY occurred_at DESC, id DESC
         LIMIT ? OFFSET ?`
    ).bind(kind, domain, limit, keep).all();
    return (rows2.results ?? []).map((row) => row.id);
  }
  const rows = await raw2.prepare(
    `SELECT id FROM mailbox_messages
       WHERE kind = ? AND domain = ?
       ORDER BY occurred_at DESC, id DESC
       LIMIT -1 OFFSET ?`
  ).bind(kind, domain, keep).all();
  return (rows.results ?? []).map((row) => row.id);
}
var DEFAULT_LIMIT, MAX_LIMIT;
var init_messages = __esm({
  "db/mail/messages.ts"() {
    "use strict";
    init_drizzle_orm();
    DEFAULT_LIMIT = 50;
    MAX_LIMIT = 200;
    __name(parseMailboxCursor, "parseMailboxCursor");
    __name(encodeMailboxCursor, "encodeMailboxCursor");
    __name(recipientsColumn, "recipientsColumn");
    __name(upsertMailboxMessage, "upsertMailboxMessage");
    __name(deleteMailboxMessages, "deleteMailboxMessages");
    __name(updateMailboxReadState, "updateMailboxReadState");
    __name(splitAddressList, "splitAddressList");
    __name(mailboxIdsForDomain, "mailboxIdsForDomain");
    __name(mailboxCounts, "mailboxCounts");
    __name(mailboxAddressCounts, "mailboxAddressCounts");
    __name(mailboxFreshness, "mailboxFreshness");
    __name(listMailboxPage, "listMailboxPage");
    __name(mailboxPruneIds, "mailboxPruneIds");
  }
});

// db/app/inbound-events.ts
async function enqueueInboundEventRow(db, event) {
  if (!db) return;
  const createdAt = event.createdAt;
  const expiresAt = new Date(
    new Date(createdAt).getTime() + TTL_SECONDS * 1e3
  ).toISOString();
  await db.insert(inboundEvents).values({
    id: event.id,
    domain: event.data.domain,
    eventType: event.type,
    createdAt,
    payloadJson: JSON.stringify(event.data),
    expiresAt
  }).run();
}
async function listPendingEventRows(db, domain, limit = 25) {
  if (!db) return [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.delete(inboundEvents).where(and(eq(inboundEvents.domain, domain.trim().toLowerCase()), lt(inboundEvents.expiresAt, now))).run();
  const rows = await db.select().from(inboundEvents).where(eq(inboundEvents.domain, domain.trim().toLowerCase())).orderBy(asc(inboundEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 100)).all();
  return rows.map((row) => ({
    id: row.id,
    type: row.eventType,
    createdAt: row.createdAt,
    data: JSON.parse(row.payloadJson)
  }));
}
async function ackPendingEventRows(db, domain, ids) {
  if (!db || ids.length === 0) return 0;
  let deleted = 0;
  for (const id of ids) {
    const result = await db.delete(inboundEvents).where(and(eq(inboundEvents.id, id), eq(inboundEvents.domain, domain.trim().toLowerCase()))).run();
    deleted += result.meta.changes;
  }
  return deleted;
}
var TTL_SECONDS;
var init_inbound_events = __esm({
  "db/app/inbound-events.ts"() {
    "use strict";
    init_drizzle_orm();
    init_schema();
    TTL_SECONDS = 7 * 24 * 60 * 60;
    __name(enqueueInboundEventRow, "enqueueInboundEventRow");
    __name(listPendingEventRows, "listPendingEventRows");
    __name(ackPendingEventRows, "ackPendingEventRows");
  }
});

// src/lib/inbound-events.ts
var inbound_events_exports = {};
__export(inbound_events_exports, {
  ackPendingEvents: () => ackPendingEvents,
  enqueueInboundEvent: () => enqueueInboundEvent,
  listPendingEvents: () => listPendingEvents
});
async function enqueueInboundEvent(db, meta) {
  const eventId = `evt_${meta.id}`;
  const event = {
    id: eventId,
    type: "inbound.email.received",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    data: {
      messageId: meta.id,
      domain: meta.domain,
      from: meta.fromEmail,
      to: meta.toEmail,
      subject: meta.subject,
      preview: meta.bodyPreview,
      receivedAt: meta.receivedAt,
      hasAttachments: meta.attachments.length > 0
    }
  };
  await enqueueInboundEventRow(db, event);
  return event;
}
async function listPendingEvents(db, domain, limit = 25) {
  const events = await listPendingEventRows(db, domain, limit);
  events.sort((a, b) => b.data.receivedAt.localeCompare(a.data.receivedAt));
  return events;
}
async function ackPendingEvents(db, domain, ids) {
  return ackPendingEventRows(db, domain, ids);
}
var init_inbound_events2 = __esm({
  "src/lib/inbound-events.ts"() {
    "use strict";
    init_inbound_events();
    __name(enqueueInboundEvent, "enqueueInboundEvent");
    __name(listPendingEvents, "listPendingEvents");
    __name(ackPendingEvents, "ackPendingEvents");
  }
});

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index2 = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index2) {
        throw new Error("next() called multiple times");
      }
      index2 = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/buffer.js
var bufferToFormData = /* @__PURE__ */ __name((arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
}, "bufferToFormData");

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/body.js
var isRawRequest = /* @__PURE__ */ __name((request) => "headers" in request, "isRawRequest");
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index2) => {
    if (index2 === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index2) => {
    const mark = `@${index2}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str, "tryDecodeURIComponent");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/request.js
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text2) => JSON.parse(text2));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   // Append multiple headers using the append option (e.g. Vary)
   *   c.header('Vary', 'Accept-Encoding', { append: true })
   *   c.header('Vary', 'User-Agent', { append: true })
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count3 = 0;
        for (const k in headers) {
          if (++count3 > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text2, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text2) : this.#newResponse(
      text2,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index2 = match3.indexOf("", 1);
    return [matcher[1][index2], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index2, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index2;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = /* @__PURE__ */ Object.create(null);
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      Object.keys(middleware).forEach((m) => {
        if ((method === METHOD_NAME_ALL || method === m) && !middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      });
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          if (!routes[m][path2]) {
            this.#insertPath(m, path2);
            routes[m][path2] = [
              ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
            ];
          }
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = this.#tries = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = /* @__PURE__ */ Object.create(null);
    const handlerData = [];
    [middleware, routes].forEach((r) => {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
          continue;
        }
        const paramAssoc = pathData[1];
        handlerData[pathData[0]] = handlers.map(([h, paramCount]) => {
          const paramIndexMap = /* @__PURE__ */ Object.create(null);
          paramCount -= 1;
          for (; paramCount >= 0; paramCount--) {
            const [key, value] = paramAssoc[paramCount];
            paramIndexMap[key] = value;
          }
          return [h, paramIndexMap];
        });
      }
    });
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (let i = 0, len = handlerData.length; i < len; i++) {
      for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
        const map = handlerData[i][j]?.[1];
        if (!map) {
          continue;
        }
        const keys = Object.keys(map);
        for (let k = 0, len3 = keys.length; k < len3; k++) {
          map[keys[k]] = paramReplacementMap[map[keys[k]]];
        }
      }
    }
    const handlerMap = [];
    for (const i in indexReplacementMap) {
      handlerMap[i] = handlerData[indexReplacementMap[i]];
    }
    return [regexp, handlerMap, staticMap];
  }
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var order = 0;
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods = [];
  #children = /* @__PURE__ */ Object.create(null);
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new _Node2();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) {
        possibleKeys.add(pattern[1]);
      }
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: [...possibleKeys],
        score: ++order
      }
    });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      if (handlerSet) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) {
            continue;
          }
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node = new Node2();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) {
      this.#node.insert(method, result, handler);
    }
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/.pnpm/hono@4.13.3/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// src/lib/cors.ts
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === "https://relaybase.xyz" || origin === "https://www.relaybase.xyz") {
    return true;
  }
  if (origin === "null") return true;
  if (origin.startsWith("tauri://") || origin.startsWith("asset://")) {
    return true;
  }
  if (origin.startsWith("capacitor://") || origin.startsWith("http://")) {
    return true;
  }
  try {
    const u = new URL(origin);
    if (u.hostname === "tauri.localhost" || u.hostname.endsWith(".tauri.localhost")) {
      return true;
    }
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
__name(isAllowedOrigin, "isAllowedOrigin");
function applyCorsHeaders(c, origin) {
  if (origin && isAllowedOrigin(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
  }
  c.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  c.header(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept"
  );
  c.header("Access-Control-Max-Age", "86400");
}
__name(applyCorsHeaders, "applyCorsHeaders");
var desktopCors = /* @__PURE__ */ __name(async (c, next) => {
  const origin = c.req.header("Origin");
  if (c.req.method === "OPTIONS") {
    applyCorsHeaders(c, origin);
    return c.body(null, 204);
  }
  await next();
  applyCorsHeaders(c, origin);
}, "desktopCors");

// src/lib/d1-status.ts
var D1_LOGS_DATABASE_NAME = "relaybase-logs";
var D1_MAIL_DATABASE_NAME = "relaybase-mail";
var D1_APP_DATABASE_NAME = "relaybase-db";
var D1_LOGS_BINDING = "RELAYBASE_LOGS";
var D1_MAIL_BINDING = "RELAYBASE_MAIL";
var D1_APP_BINDING = "RELAYBASE_DB";
var D1_DATABASE_SIZE_LIMIT_BYTES = 10 * 1024 ** 3;
var LOGS_TABLE = "ops_log";
var MAIL_TABLE = "mailbox_messages";
var APP_TABLE = "domains";
async function tableReady(db, tableName) {
  if (!db) return false;
  try {
    await db.prepare(`SELECT 1 AS ok FROM ${tableName} LIMIT 1`).first();
    return true;
  } catch (error) {
    console.error(`D1 table check failed (${tableName})`, error);
    return false;
  }
}
__name(tableReady, "tableReady");
async function databaseSizeBytes(db) {
  if (!db) return null;
  const queries = [
    `SELECT
      (SELECT * FROM pragma_page_count()) *
      (SELECT * FROM pragma_page_size()) AS size_bytes`,
    `SELECT page_count * page_size AS size_bytes
     FROM pragma_page_count(), pragma_page_size()`
  ];
  for (const sql4 of queries) {
    try {
      const row = await db.prepare(sql4).first();
      const size = row?.size_bytes;
      if (typeof size === "number" && Number.isFinite(size) && size >= 0) {
        return size;
      }
    } catch {
    }
  }
  return null;
}
__name(databaseSizeBytes, "databaseSizeBytes");
async function databaseSizeFromCfApi(accountId, apiToken, databaseName) {
  const id = accountId?.trim();
  const token = apiToken?.trim();
  if (!id || !token) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${id}/d1/database`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const match2 = json.result?.find((entry) => entry.name === databaseName);
    const size = match2?.file_size;
    return typeof size === "number" && Number.isFinite(size) && size >= 0 ? size : null;
  } catch (error) {
    console.error("D1 Cloudflare API size lookup failed", error);
    return null;
  }
}
__name(databaseSizeFromCfApi, "databaseSizeFromCfApi");
async function probeBinding(db, tableName, databaseName, binding, cfAccountId, cfApiToken) {
  if (!db) {
    return {
      configured: false,
      databaseName,
      binding,
      sizeBytes: null
    };
  }
  const configured = await tableReady(db, tableName);
  if (!configured) {
    return { configured: false, databaseName, binding, sizeBytes: null };
  }
  let sizeBytes = await databaseSizeBytes(db);
  if (sizeBytes == null) {
    sizeBytes = await databaseSizeFromCfApi(cfAccountId, cfApiToken, databaseName);
  }
  return { configured: true, databaseName, binding, sizeBytes };
}
__name(probeBinding, "probeBinding");
async function probeD1Connection(logs, mail, app2, cfAccountId, cfApiToken) {
  const [logsStatus, mailStatus, appStatus] = await Promise.all([
    probeBinding(
      logs,
      LOGS_TABLE,
      D1_LOGS_DATABASE_NAME,
      D1_LOGS_BINDING,
      cfAccountId,
      cfApiToken
    ),
    probeBinding(
      mail,
      MAIL_TABLE,
      D1_MAIL_DATABASE_NAME,
      D1_MAIL_BINDING,
      cfAccountId,
      cfApiToken
    ),
    probeBinding(
      app2,
      APP_TABLE,
      D1_APP_DATABASE_NAME,
      D1_APP_BINDING,
      cfAccountId,
      cfApiToken
    )
  ]);
  return {
    logs: logsStatus,
    mail: mailStatus,
    app: appStatus
  };
}
__name(probeD1Connection, "probeD1Connection");

// src/lib/auth.ts
init_app();

// src/lib/crypto.ts
var API_KEY_PREFIX = "rb_";
var LEGACY_API_KEY_PREFIX = "fes_";
var KEY_PREFIX_LENGTH = 8;
function stripApiKeyPrefix(apiKey) {
  if (apiKey.startsWith(API_KEY_PREFIX)) {
    return apiKey.slice(API_KEY_PREFIX.length);
  }
  if (apiKey.startsWith(LEGACY_API_KEY_PREFIX)) {
    return apiKey.slice(LEGACY_API_KEY_PREFIX.length);
  }
  return apiKey;
}
__name(stripApiKeyPrefix, "stripApiKeyPrefix");
function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex, "bytesToHex");
function bytesToBase64Url(bytes) {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(bytesToBase64Url, "bytesToBase64Url");
async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}
__name(sha256Hex, "sha256Hex");
function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${API_KEY_PREFIX}${bytesToBase64Url(bytes)}`;
}
__name(generateApiKey, "generateApiKey");
function keyPrefixFromApiKey(apiKey) {
  return stripApiKeyPrefix(apiKey).slice(0, KEY_PREFIX_LENGTH);
}
__name(keyPrefixFromApiKey, "keyPrefixFromApiKey");
function isValidApiKeyFormat(apiKey) {
  const hasKnownPrefix = apiKey.startsWith(API_KEY_PREFIX) || apiKey.startsWith(LEGACY_API_KEY_PREFIX);
  if (!hasKnownPrefix) return false;
  return stripApiKeyPrefix(apiKey).length > KEY_PREFIX_LENGTH;
}
__name(isValidApiKeyFormat, "isValidApiKeyFormat");
function isValidDomain(domain) {
  const d = domain.trim().toLowerCase();
  if (!d || d.includes("@") || d.includes("/") || d.includes(" ")) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d);
}
__name(isValidDomain, "isValidDomain");
function emailMatchesDomain(email, domain) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDomain = domain.trim().toLowerCase();
  return normalizedEmail.endsWith(`@${normalizedDomain}`);
}
__name(emailMatchesDomain, "emailMatchesDomain");

// db/app/keys.ts
init_drizzle_orm();
init_schema();
function rowToRecord(row) {
  return {
    id: row.id,
    domain: row.domain,
    label: row.label,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt,
    active: row.active === 1
  };
}
__name(rowToRecord, "rowToRecord");
async function createKeyRow(db, input) {
  if (!db) return;
  await db.insert(apiKeys).values({
    id: input.id,
    keyHash: input.keyHash,
    domain: input.domain,
    label: input.label,
    keyPrefix: input.keyPrefix,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    active: 1
  }).run();
}
__name(createKeyRow, "createKeyRow");
async function resolveKeyByHash(db, keyHash) {
  if (!db) return null;
  const row = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).get();
  if (!row || row.active !== 1) return null;
  return rowToRecord(row);
}
__name(resolveKeyByHash, "resolveKeyByHash");
async function listKeys(db) {
  if (!db) return [];
  const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)).all();
  return rows.map(rowToRecord);
}
__name(listKeys, "listKeys");
async function deleteKeyRow(db, id) {
  if (!db) return false;
  const result = await db.delete(apiKeys).where(eq(apiKeys.id, id)).run();
  return result.meta.changes > 0;
}
__name(deleteKeyRow, "deleteKeyRow");
async function setKeyActive(db, id, active) {
  if (!db) return null;
  await db.update(apiKeys).set({ active: active ? 1 : 0 }).where(eq(apiKeys.id, id)).run();
  const row = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).get();
  return row ? rowToRecord(row) : null;
}
__name(setKeyActive, "setKeyActive");
async function updateKeyHash(db, id, keyHash, keyPrefix) {
  if (!db) return;
  await db.update(apiKeys).set({ keyHash, keyPrefix, active: 1 }).where(eq(apiKeys.id, id)).run();
}
__name(updateKeyHash, "updateKeyHash");

// src/lib/keys.ts
async function createKey(db, params) {
  const domain = params.domain.trim().toLowerCase();
  if (!isValidDomain(domain)) {
    throw new Error("domain must be a valid hostname (e.g. example.com)");
  }
  const apiKey = generateApiKey();
  const keyHash = await sha256Hex(apiKey);
  const id = crypto.randomUUID();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const keyPrefix = keyPrefixFromApiKey(apiKey);
  await createKeyRow(db, {
    id,
    keyHash,
    domain,
    label: params.label?.trim() || null,
    keyPrefix
  });
  return {
    record: { id, domain, label: params.label?.trim() || null, keyPrefix, createdAt, active: true },
    apiKey
  };
}
__name(createKey, "createKey");
async function listKeys2(db) {
  return listKeys(db);
}
__name(listKeys2, "listKeys");
async function resolveKey(db, apiKey) {
  if (!isValidApiKeyFormat(apiKey)) return null;
  const keyHash = await sha256Hex(apiKey);
  return resolveKeyByHash(db, keyHash);
}
__name(resolveKey, "resolveKey");
async function revokeKey(db, id) {
  return deleteKeyRow(db, id);
}
__name(revokeKey, "revokeKey");
async function setKeyActive2(db, id, active) {
  return setKeyActive(db, id, active);
}
__name(setKeyActive2, "setKeyActive");
async function rotateKey(db, id) {
  if (!db) return null;
  const existing = (await listKeys(db)).find((k) => k.id === id);
  if (!existing) return null;
  const apiKey = generateApiKey();
  const keyHash = await sha256Hex(apiKey);
  const keyPrefix = keyPrefixFromApiKey(apiKey);
  await updateKeyHash(db, id, keyHash, keyPrefix);
  return {
    record: { ...existing, keyPrefix, active: true },
    apiKey
  };
}
__name(rotateKey, "rotateKey");

// src/lib/owner-auth.ts
init_app();

// db/app/owner-sessions.ts
init_drizzle_orm();
init_schema();
async function createOwnerSession(db, input) {
  if (!db) return;
  await db.insert(ownerSessions).values({
    id: input.id,
    tokenHash: input.tokenHash,
    family: input.family,
    label: input.label,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: input.expiresAt
  }).run();
}
__name(createOwnerSession, "createOwnerSession");
async function findOwnerSessionByHash(db, tokenHash) {
  if (!db) return null;
  const row = await db.select().from(ownerSessions).where(eq(ownerSessions.tokenHash, tokenHash)).get();
  return row ?? null;
}
__name(findOwnerSessionByHash, "findOwnerSessionByHash");
async function deleteOwnerSession(db, id) {
  if (!db) return;
  await db.delete(ownerSessions).where(eq(ownerSessions.id, id)).run();
}
__name(deleteOwnerSession, "deleteOwnerSession");
async function deleteOwnerSessionByHash(db, tokenHash) {
  if (!db) return;
  await db.delete(ownerSessions).where(eq(ownerSessions.tokenHash, tokenHash)).run();
}
__name(deleteOwnerSessionByHash, "deleteOwnerSessionByHash");
async function deleteAllOwnerSessions(db) {
  if (!db) return;
  await db.delete(ownerSessions).run();
}
__name(deleteAllOwnerSessions, "deleteAllOwnerSessions");

// db/app/owner.ts
init_drizzle_orm();
init_schema();
async function getOwnerLoginConfig(db) {
  if (!db) return null;
  try {
    const row = await db.select().from(ownerConfig).where(eq(ownerConfig.id, 1)).get();
    if (!row) return null;
    return {
      ownerEmail: row.ownerEmail ?? null,
      workerUrl: row.workerUrl ?? null,
      passtokenSalt: row.passtokenSalt ?? null,
      passtokenHash: row.passtokenHash ?? null,
      passtokenPrefix: row.passtokenPrefix ?? null,
      passtokenUpdatedAt: row.passtokenUpdatedAt ?? null
    };
  } catch {
    return null;
  }
}
__name(getOwnerLoginConfig, "getOwnerLoginConfig");
async function ownerIsConfigured(db) {
  const cfg = await getOwnerLoginConfig(db);
  return Boolean(cfg?.passtokenHash);
}
__name(ownerIsConfigured, "ownerIsConfigured");
async function setOwnerLogin(db, input) {
  if (!db) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.insert(ownerConfig).values({
    id: 1,
    passtokenSalt: input.passtokenSalt,
    passtokenHash: input.passtokenHash,
    passtokenPrefix: input.passtokenPrefix,
    passtokenUpdatedAt: now
  }).onConflictDoUpdate({
    target: ownerConfig.id,
    set: {
      passtokenSalt: input.passtokenSalt,
      passtokenHash: input.passtokenHash,
      passtokenPrefix: input.passtokenPrefix,
      passtokenUpdatedAt: now
    }
  }).run();
}
__name(setOwnerLogin, "setOwnerLogin");
async function setOwnerConfig(db, input) {
  if (!db) return;
  await db.insert(ownerConfig).values({
    id: 1,
    ownerEmail: input.ownerEmail,
    workerUrl: input.workerUrl
  }).onConflictDoUpdate({
    target: ownerConfig.id,
    set: {
      ownerEmail: input.ownerEmail,
      workerUrl: input.workerUrl
    }
  }).run();
}
__name(setOwnerConfig, "setOwnerConfig");

// src/lib/owner-tokens.ts
var PASSTOKEN_PREFIX = "rb_pass_";
var PASSTOKEN_PREFIX_LENGTH = 10;
function bytesToBase64Url2(bytes) {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(bytesToBase64Url2, "bytesToBase64Url");
function bytesToHex2(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex2, "bytesToHex");
function generatePasstoken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${PASSTOKEN_PREFIX}${bytesToBase64Url2(bytes)}`;
}
__name(generatePasstoken, "generatePasstoken");
function passtokenPrefix(token) {
  const stripped = token.startsWith(PASSTOKEN_PREFIX) ? token.slice(PASSTOKEN_PREFIX.length) : token;
  return stripped.slice(0, PASSTOKEN_PREFIX_LENGTH);
}
__name(passtokenPrefix, "passtokenPrefix");
function isValidPasstokenFormat(token) {
  const trimmed = token.trim();
  if (!trimmed.startsWith(PASSTOKEN_PREFIX)) return false;
  return trimmed.length > PASSTOKEN_PREFIX.length + PASSTOKEN_PREFIX_LENGTH;
}
__name(isValidPasstokenFormat, "isValidPasstokenFormat");
function randomSalt() {
  return bytesToHex2(crypto.getRandomValues(new Uint8Array(16)));
}
__name(randomSalt, "randomSalt");
async function hashPasstoken(pepper, salt, passtoken) {
  return sha256Hex(`${pepper}:${salt}:${passtoken.trim()}`);
}
__name(hashPasstoken, "hashPasstoken");
var ACCESS_SEPARATOR = ".";
function base64UrlEncode(input) {
  return bytesToBase64Url2(new TextEncoder().encode(input));
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(input) {
  const bin = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(
    Uint8Array.from(bin, (c) => c.charCodeAt(0))
  );
}
__name(base64UrlDecode, "base64UrlDecode");
async function hmacSha256Hex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return bytesToHex2(new Uint8Array(sig));
}
__name(hmacSha256Hex, "hmacSha256Hex");
var MAIL_ACCESS_TTL_SECONDS = 60 * 60;
var CONSOLE_ACCESS_TTL_SECONDS = 30 * 60;
var MAIL_REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60;
var CONSOLE_REFRESH_TTL_SECONDS = 30 * 60;
function sessionLabelForScope(scope, deviceLabel) {
  const trimmed = deviceLabel.trim() || "desktop";
  return `${scope}:${trimmed}`;
}
__name(sessionLabelForScope, "sessionLabelForScope");
function scopeFromSessionLabel(label) {
  if (!label) return null;
  if (label.startsWith("mail:")) return "mail";
  if (label.startsWith("console:")) return "console";
  return null;
}
__name(scopeFromSessionLabel, "scopeFromSessionLabel");
async function signAccessToken(pepper, payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSha256Hex(pepper, body);
  return `${body}${ACCESS_SEPARATOR}${sig}`;
}
__name(signAccessToken, "signAccessToken");
async function verifyAccessToken(pepper, token) {
  const parts = token.split(ACCESS_SEPARATOR);
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await hmacSha256Hex(pepper, body);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number" || typeof payload.jti !== "string") {
      return null;
    }
    if (payload.scope !== void 0 && payload.scope !== "mail" && payload.scope !== "console") {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyAccessToken, "verifyAccessToken");
function generateRefreshToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url2(bytes);
}
__name(generateRefreshToken, "generateRefreshToken");

// src/lib/owner-auth.ts
var OWNER_SUB = "owner";
function accessTtlForScope(scope) {
  return scope === "mail" ? MAIL_ACCESS_TTL_SECONDS : CONSOLE_ACCESS_TTL_SECONDS;
}
__name(accessTtlForScope, "accessTtlForScope");
function refreshTtlForScope(scope) {
  return scope === "mail" ? MAIL_REFRESH_TTL_SECONDS : CONSOLE_REFRESH_TTL_SECONDS;
}
__name(refreshTtlForScope, "refreshTtlForScope");
function requirePepper(env) {
  const pepper = env.AUTH_PEPPER?.trim() ?? "";
  if (!pepper) {
    return {
      error: "Worker is missing AUTH_PEPPER. Re-run Setup so the install can set it.",
      status: 503
    };
  }
  return pepper;
}
__name(requirePepper, "requirePepper");
async function mintScopedAccess(pepper, scope) {
  const now = Math.floor(Date.now() / 1e3);
  const expiresIn = accessTtlForScope(scope);
  const accessPayload = {
    sub: OWNER_SUB,
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID(),
    scope
  };
  const accessToken = await signAccessToken(pepper, accessPayload);
  return { accessToken, expiresIn };
}
__name(mintScopedAccess, "mintScopedAccess");
async function createScopedRefreshSession(db, scope, label) {
  const refreshToken = generateRefreshToken();
  const refreshHash = await sha256Hex(refreshToken);
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(
    now.getTime() + refreshTtlForScope(scope) * 1e3
  ).toISOString();
  const deviceLabel = label?.trim() || "desktop";
  await createOwnerSession(db, {
    id: crypto.randomUUID(),
    tokenHash: refreshHash,
    family: crypto.randomUUID(),
    label: sessionLabelForScope(scope, deviceLabel),
    expiresAt
  });
  return refreshToken;
}
__name(createScopedRefreshSession, "createScopedRefreshSession");
async function setupOwner(env, input) {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepperOrErr = requirePepper(env);
  if (typeof pepperOrErr !== "string") return pepperOrErr;
  const pepper = pepperOrErr;
  if (pepper !== input.pepper.trim()) {
    return { error: "Unauthorized", status: 401 };
  }
  if (await ownerIsConfigured(db)) {
    return { error: "Owner already configured", status: 409 };
  }
  const salt = randomSalt();
  const passtoken = generatePasstoken();
  const hash = await hashPasstoken(pepper, salt, passtoken);
  await setOwnerLogin(db, {
    passtokenSalt: salt,
    passtokenHash: hash,
    passtokenPrefix: passtokenPrefix(passtoken)
  });
  return { result: { passtoken } };
}
__name(setupOwner, "setupOwner");
async function loginOwner(env, input) {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepperOrErr = requirePepper(env);
  if (typeof pepperOrErr !== "string") return pepperOrErr;
  const pepper = pepperOrErr;
  const cfg = await getOwnerLoginConfig(db);
  if (!cfg || !cfg.passtokenHash || !cfg.passtokenSalt) {
    return { error: "Invalid credentials", status: 401 };
  }
  const passtokenOk = isValidPasstokenFormat(input.passtoken) && await hashPasstoken(pepper, cfg.passtokenSalt, input.passtoken) === cfg.passtokenHash;
  if (!passtokenOk) {
    return { error: "Invalid credentials", status: 401 };
  }
  const mailRefreshToken = await createScopedRefreshSession(
    db,
    "mail",
    input.label ?? null
  );
  const consoleRefreshToken = await createScopedRefreshSession(
    db,
    "console",
    input.label ?? null
  );
  const { accessToken: mailAccessToken, expiresIn: mailExpiresIn } = await mintScopedAccess(pepper, "mail");
  return {
    result: {
      mailAccessToken,
      mailRefreshToken,
      consoleRefreshToken,
      mailExpiresIn
    }
  };
}
__name(loginOwner, "loginOwner");
async function refreshOwner(env, refreshToken, scope) {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepperOrErr = requirePepper(env);
  if (typeof pepperOrErr !== "string") return pepperOrErr;
  const pepper = pepperOrErr;
  const hash = await sha256Hex(refreshToken.trim());
  const session = await findOwnerSessionByHash(db, hash);
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }
  const sessionScope = scopeFromSessionLabel(session.label);
  if (sessionScope !== null && sessionScope !== scope) {
    return { error: "Unauthorized", status: 401 };
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await deleteOwnerSession(db, session.id);
    return { error: "Unauthorized", status: 401 };
  }
  await deleteOwnerSession(db, session.id);
  const cfg = await getOwnerLoginConfig(db);
  if (!cfg?.passtokenHash) {
    return { error: "Unauthorized", status: 401 };
  }
  const newRefresh = generateRefreshToken();
  const newHash = await sha256Hex(newRefresh);
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(
    now.getTime() + refreshTtlForScope(scope) * 1e3
  ).toISOString();
  const label = sessionScope !== null ? session.label : sessionLabelForScope(scope, session.label ?? "desktop");
  await createOwnerSession(db, {
    id: crypto.randomUUID(),
    tokenHash: newHash,
    family: session.family,
    label,
    expiresAt
  });
  const { accessToken, expiresIn } = await mintScopedAccess(pepper, scope);
  return {
    result: {
      accessToken,
      refreshToken: newRefresh,
      expiresIn,
      scope
    }
  };
}
__name(refreshOwner, "refreshOwner");
async function logoutOwner(env, refreshToken) {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return;
  const hash = await sha256Hex(refreshToken.trim());
  await deleteOwnerSessionByHash(db, hash);
}
__name(logoutOwner, "logoutOwner");
async function rotatePasstoken(env) {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepperOrErr = requirePepper(env);
  if (typeof pepperOrErr !== "string") return pepperOrErr;
  const pepper = pepperOrErr;
  const cfg = await getOwnerLoginConfig(db);
  if (!cfg?.passtokenHash) return { error: "Unauthorized", status: 401 };
  const salt = randomSalt();
  const passtoken = generatePasstoken();
  const hash = await hashPasstoken(pepper, salt, passtoken);
  await setOwnerLogin(db, {
    passtokenSalt: salt,
    passtokenHash: hash,
    passtokenPrefix: passtokenPrefix(passtoken)
  });
  await deleteAllOwnerSessions(db);
  return { passtoken };
}
__name(rotatePasstoken, "rotatePasstoken");
async function resetOwner(env, input) {
  const db = createAppDb(env.RELAYBASE_DB);
  if (!db) return { error: "Database not configured", status: 503 };
  const pepperOrErr = requirePepper(env);
  if (typeof pepperOrErr !== "string") return pepperOrErr;
  const pepper = pepperOrErr;
  const expectedAccount = env.CF_ACCOUNT_ID?.trim() ?? "";
  if (!expectedAccount) {
    return { error: "Worker is missing CF_ACCOUNT_ID", status: 503 };
  }
  const verified = await verifyCfTokenForReset(
    input.cfAccessToken,
    expectedAccount
  );
  if (!verified.ok) return { error: "Unauthorized", status: 401 };
  const salt = randomSalt();
  const passtoken = generatePasstoken();
  const hash = await hashPasstoken(pepper, salt, passtoken);
  await setOwnerLogin(db, {
    passtokenSalt: salt,
    passtokenHash: hash,
    passtokenPrefix: passtokenPrefix(passtoken)
  });
  await deleteAllOwnerSessions(db);
  return { passtoken };
}
__name(resetOwner, "resetOwner");
async function verifyCfTokenAccount(token, expectedAccount) {
  const bearer = token.trim();
  const expected = expectedAccount.trim();
  if (!bearer || !expected) return { ok: false };
  try {
    const accRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(expected)}`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    const accData = await accRes.json();
    const id = accData.result?.id?.trim() ?? "";
    if (!accData.success || id !== expected) return { ok: false };
    return { ok: true, accountId: expected };
  } catch {
    return { ok: false };
  }
}
__name(verifyCfTokenAccount, "verifyCfTokenAccount");
async function verifyCfTokenSecretsStore(token, expectedAccount) {
  const bearer = token.trim();
  const expected = expectedAccount.trim();
  if (!bearer || !expected) return { ok: false };
  try {
    const storeRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(expected)}/secrets_store/stores?per_page=1`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    const storeData = await storeRes.json();
    if (!storeData.success) return { ok: false };
    return { ok: true, accountId: expected };
  } catch {
    return { ok: false };
  }
}
__name(verifyCfTokenSecretsStore, "verifyCfTokenSecretsStore");
async function verifyCfTokenForReset(token, expectedAccount) {
  const store = await verifyCfTokenSecretsStore(token, expectedAccount);
  if (store.ok) return store;
  return verifyCfTokenAccount(token, expectedAccount);
}
__name(verifyCfTokenForReset, "verifyCfTokenForReset");

// src/lib/auth.ts
function extractBearerToken(authHeader) {
  if (!authHeader) return null;
  const match2 = authHeader.match(/^Bearer\s+(.+)$/i);
  return match2?.[1]?.trim() ?? null;
}
__name(extractBearerToken, "extractBearerToken");
async function requireOwnerSession(c, scope) {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const pepper = c.env.AUTH_PEPPER?.trim() ?? "";
  if (!pepper) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyAccessToken(pepper, token);
  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (payload.scope !== void 0 && payload.scope !== scope) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (payload.scope === void 0 && scope !== "console") {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = createAppDb(c.env.RELAYBASE_DB);
  if (db) {
    const cfg = await getOwnerLoginConfig(db);
    if (!cfg?.passtokenHash) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  return null;
}
__name(requireOwnerSession, "requireOwnerSession");
function requireConsoleSession(c) {
  return requireOwnerSession(c, "console");
}
__name(requireConsoleSession, "requireConsoleSession");
function requireMailSession(c) {
  return requireOwnerSession(c, "mail");
}
__name(requireMailSession, "requireMailSession");
async function requirePepperBootstrap(c) {
  const pepper = c.env.AUTH_PEPPER?.trim() ?? "";
  if (!pepper) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const provided = c.req.header("X-Auth-Pepper")?.trim() ?? "";
  if (!provided || provided !== pepper) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}
__name(requirePepperBootstrap, "requirePepperBootstrap");
async function requireCfAccountProof(c) {
  const token = c.req.header("X-Cf-Access-Token")?.trim() ?? "";
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const expected = c.env.CF_ACCOUNT_ID?.trim() ?? "";
  if (!expected) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const verified = await verifyCfTokenAccount(token, expected);
  if (!verified.ok) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}
__name(requireCfAccountProof, "requireCfAccountProof");
async function requireSchemaAuth(c, hasOwner) {
  if (!await requireConsoleSession(c)) return null;
  if (!await requireCfAccountProof(c)) return null;
  if (!hasOwner) return requirePepperBootstrap(c);
  return c.json({ error: "Unauthorized" }, 401);
}
__name(requireSchemaAuth, "requireSchemaAuth");
async function requireApiKey(c) {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const record = await resolveKey(createAppDb(c.env.RELAYBASE_DB), token);
  if (!record) {
    return c.json({ error: "Invalid or inactive API key" }, 401);
  }
  return { record };
}
__name(requireApiKey, "requireApiKey");

// src/routes/console/audience-groups.ts
init_app();
init_catalog_audience();
var consoleAudienceGroups = new Hono2();
consoleAudienceGroups.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const catalog = await readAudienceCatalog(createAppDb(c.env.RELAYBASE_DB));
  return c.json({ groups: listGroupSummaries(catalog) });
});
consoleAudienceGroups.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const group = await createAudienceGroup(createAppDb(c.env.RELAYBASE_DB), {
      name: body.name ?? "",
      domain: body.domain ?? "",
      dataSource: body.dataSource,
      cronEnabled: body.cronEnabled,
      cronIntervalMinutes: body.cronIntervalMinutes
    });
    return c.json({ group }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleAudienceGroups.post("/test", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    let previous;
    if (body.groupId) {
      const catalog = await readAudienceCatalog(createAppDb(c.env.RELAYBASE_DB));
      previous = catalog.groups.find((g) => g.id === body.groupId)?.dataSource;
    }
    const dataSource = mergeDataSource2(previous, body);
    const result = await fetchDataSourceContacts(dataSource);
    return c.json({
      ok: true,
      count: result.contacts.length,
      skippedCount: result.skippedCount,
      sample: result.contacts.slice(0, 5)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test failed";
    return c.json({ error: message }, 400);
  }
});
consoleAudienceGroups.get("/:groupId", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const catalog = await readAudienceCatalog(createAppDb(c.env.RELAYBASE_DB));
  const detail = getGroupDetail2(catalog, c.req.param("groupId"));
  if (!detail) return c.json({ error: "Audience group not found" }, 404);
  return c.json(detail);
});
consoleAudienceGroups.patch("/:groupId", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const group = await updateAudienceGroup(
      createAppDb(c.env.RELAYBASE_DB),
      c.req.param("groupId"),
      body
    );
    return c.json({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleAudienceGroups.delete("/:groupId", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  try {
    await deleteAudienceGroup(createAppDb(c.env.RELAYBASE_DB), c.req.param("groupId"));
    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleAudienceGroups.get("/:groupId/contacts", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const catalog = await readAudienceCatalog(createAppDb(c.env.RELAYBASE_DB));
  const detail = getGroupDetail2(catalog, c.req.param("groupId"));
  if (!detail) return c.json({ error: "Audience group not found" }, 404);
  return c.json({ contacts: detail.contacts });
});
consoleAudienceGroups.post("/:groupId/contacts", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const contact = await addManualContact2(
      createAppDb(c.env.RELAYBASE_DB),
      c.req.param("groupId"),
      { email: body.email ?? "", name: body.name }
    );
    return c.json({ contact }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleAudienceGroups.delete("/:groupId/contacts", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const contactId = c.req.query("id")?.trim();
  if (!contactId) return c.json({ error: "id is required" }, 400);
  try {
    await removeContact2(
      createAppDb(c.env.RELAYBASE_DB),
      c.req.param("groupId"),
      contactId
    );
    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleAudienceGroups.post("/:groupId/sync", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  try {
    const result = await syncAudienceGroup(
      createAppDb(c.env.RELAYBASE_DB),
      c.req.param("groupId"),
      { trigger: "manual" }
    );
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleAudienceGroups.get("/:groupId/progress", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const catalog = await readAudienceCatalog(createAppDb(c.env.RELAYBASE_DB));
  const progress = getGroupProgress(catalog, c.req.param("groupId"));
  if (!progress) return c.json({ error: "Audience group not found" }, 404);
  return c.json(progress);
});

// src/routes/console/ops-logs.ts
init_ops_logs();
var consoleOpsLogs = new Hono2();
consoleOpsLogs.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const limit = Number(c.req.query("limit") ?? "100");
  const status = c.req.query("status") ?? "all";
  const domain = c.req.query("domain")?.trim();
  if (!["all", "failed", "success"].includes(status)) {
    return c.json({ error: "status must be all, failed, or success" }, 400);
  }
  const [result, d1] = await Promise.all([
    listOpsLogs(c.env.RELAYBASE_LOGS, {
      limit: Number.isFinite(limit) ? limit : 100,
      status,
      domain
    }),
    probeD1Connection(
      c.env.RELAYBASE_LOGS,
      c.env.RELAYBASE_MAIL,
      c.env.RELAYBASE_DB,
      c.env.CF_ACCOUNT_ID,
      c.env.CF_API_TOKEN
    )
  ]);
  return c.json({
    ...result,
    workerConnected: true,
    d1Configured: d1.logs.configured
  });
});

// src/routes/console/owner-auth.ts
init_app();
var consoleOwnerAuth = new Hono2();
consoleOwnerAuth.post("/setup-admin", async (c) => {
  const denied = await requirePepperBootstrap(c);
  if (denied) return denied;
  try {
    await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await setupOwner(c.env, {
    pepper: c.req.header("X-Auth-Pepper") ?? ""
  });
  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(
    {
      ok: true,
      passtoken: result.result.passtoken,
      message: "Copy this passtoken now. It will not be shown again."
    },
    201
  );
});
consoleOwnerAuth.post("/login", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await loginOwner(c.env, {
    passtoken: body.passtoken ?? "",
    label: body.label
  });
  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json({ ok: true, ...result.result });
});
consoleOwnerAuth.post("/refresh", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const refreshToken = body.refreshToken?.trim() ?? "";
  if (!refreshToken) return c.json({ error: "refreshToken is required" }, 400);
  const scopeRaw = body.scope?.trim() ?? "console";
  if (scopeRaw !== "mail" && scopeRaw !== "console") {
    return c.json({ error: "scope must be mail or console" }, 400);
  }
  const result = await refreshOwner(c.env, refreshToken, scopeRaw);
  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json({ ok: true, ...result.result });
});
consoleOwnerAuth.post("/logout", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const refreshToken = body.refreshToken?.trim() ?? "";
  if (refreshToken) await logoutOwner(c.env, refreshToken);
  return c.json({ ok: true });
});
consoleOwnerAuth.post("/rotate-passtoken", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const result = await rotatePasstoken(c.env);
  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json({
    ok: true,
    passtoken: result.passtoken,
    message: "Copy this passtoken now. It will not be shown again."
  });
});
consoleOwnerAuth.post("/reset-admin", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const cfAccessToken = body.cfAccessToken?.trim() ?? "";
  if (!cfAccessToken) return c.json({ error: "cfAccessToken is required" }, 400);
  const result = await resetOwner(c.env, {
    cfAccessToken
  });
  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json({
    ok: true,
    passtoken: result.passtoken,
    message: "Copy this passtoken now. It will not be shown again."
  });
});
consoleOwnerAuth.get("/auth-status", async (c) => {
  const db = createAppDb(c.env.RELAYBASE_DB);
  const cfg = db ? await getOwnerLoginConfig(db) : null;
  const configured = Boolean(cfg?.passtokenHash);
  return c.json({
    ok: true,
    ownerConfigured: configured,
    passtokenPrefix: cfg?.passtokenPrefix ?? null
  });
});

// src/routes/console/rebuild-mail.ts
init_app();

// db/mail/index.ts
init_d1();

// db/mail/schema.ts
var schema_exports2 = {};
__export(schema_exports2, {
  mailboxFts: () => mailboxFts
});
init_drizzle_orm();
var mailboxFts = sql.identifier("mailbox_fts");

// db/mail/index.ts
function createMailDb(db) {
  if (!db) return null;
  return drizzle(db, { schema: schema_exports2 });
}
__name(createMailDb, "createMailDb");

// src/routes/console/rebuild-mail.ts
init_catalog_store();

// src/lib/bounce-detect.ts
var CF_BOUNCE_FROM_RE = /^bounces@cf-bounce\./i;
function isBounceMessage(raw2, fromEmail) {
  if (CF_BOUNCE_FROM_RE.test(fromEmail)) return true;
  const text2 = new TextDecoder().decode(raw2).slice(0, 4096).toLowerCase();
  return text2.includes("content-type: multipart/report") || text2.includes("content-type: message/delivery-status") || text2.includes("auto-submitted: auto-generated");
}
__name(isBounceMessage, "isBounceMessage");
function headerLineValue(text2, headerName, maxOffset) {
  const re = new RegExp(`^${headerName}\\s*:\\s*(.*)$`, "im");
  const searchArea = text2.slice(0, maxOffset);
  const match2 = re.exec(searchArea);
  const value = match2?.[1]?.trim();
  if (!value) return void 0;
  return value.replace(/\s+/g, " ").trim();
}
__name(headerLineValue, "headerLineValue");
function stripAddressPrefix(value) {
  const semi = value.indexOf(";");
  if (semi >= 0) return value.slice(semi + 1).trim();
  return value.trim();
}
__name(stripAddressPrefix, "stripAddressPrefix");
function parseBounceDiagnostic(raw2) {
  const text2 = new TextDecoder().decode(raw2);
  const maxOffset = 8192;
  const finalRecipient = headerLineValue(text2, "Final-Recipient", maxOffset);
  const diagnosticCode = headerLineValue(
    text2,
    "Diagnostic-Code",
    maxOffset
  );
  const status = headerLineValue(text2, "Status", maxOffset);
  return {
    finalRecipient: finalRecipient ? stripAddressPrefix(finalRecipient) : void 0,
    diagnosticCode: diagnosticCode ? stripAddressPrefix(diagnosticCode) : void 0,
    status: status ? stripAddressPrefix(status) : void 0
  };
}
__name(parseBounceDiagnostic, "parseBounceDiagnostic");
function buildBouncePreview(diagnostic, fallback = "Bounce: delivery failed") {
  const parts = [];
  if (diagnostic.status) parts.push(`Status ${diagnostic.status}`);
  if (diagnostic.diagnosticCode) parts.push(diagnostic.diagnosticCode);
  if (diagnostic.finalRecipient) parts.push(`to ${diagnostic.finalRecipient}`);
  if (parts.length === 0) return fallback;
  return `Bounce: ${parts.join(" \u2014 ")}`;
}
__name(buildBouncePreview, "buildBouncePreview");

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/decode-strings.js
var textEncoder = new TextEncoder();
var base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
  base64Lookup[base64Chars.charCodeAt(i)] = i;
}
function decodeBase64(base64) {
  let bufferLength = Math.ceil(base64.length / 4) * 3;
  const len = base64.length;
  let p = 0;
  if (base64.length % 4 === 3) {
    bufferLength--;
  } else if (base64.length % 4 === 2) {
    bufferLength -= 2;
  } else if (base64[base64.length - 1] === "=") {
    bufferLength--;
    if (base64[base64.length - 2] === "=") {
      bufferLength--;
    }
  }
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < len; i += 4) {
    let encoded1 = base64Lookup[base64.charCodeAt(i)];
    let encoded2 = base64Lookup[base64.charCodeAt(i + 1)];
    let encoded3 = base64Lookup[base64.charCodeAt(i + 2)];
    let encoded4 = base64Lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = encoded1 << 2 | encoded2 >> 4;
    bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
    bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
  }
  return arrayBuffer;
}
__name(decodeBase64, "decodeBase64");
var charsetAliases = /* @__PURE__ */ new Map([
  ["iso-8859-8-i", "iso-8859-8"],
  ["iso-8859-8-e", "iso-8859-8"]
]);
function getDecoder(charset) {
  charset = (charset || "utf8").trim().toLowerCase();
  charset = charsetAliases.get(charset) || charset;
  let decoder;
  try {
    decoder = new TextDecoder(charset);
  } catch (err) {
    decoder = new TextDecoder("windows-1252");
  }
  return decoder;
}
__name(getDecoder, "getDecoder");
async function blobToArrayBuffer(blob2) {
  if ("arrayBuffer" in blob2) {
    return await blob2.arrayBuffer();
  }
  const fr = new FileReader();
  return new Promise((resolve, reject) => {
    fr.onload = function(e) {
      resolve(e.target.result);
    };
    fr.onerror = function(e) {
      reject(fr.error);
    };
    fr.readAsArrayBuffer(blob2);
  });
}
__name(blobToArrayBuffer, "blobToArrayBuffer");
function getHex(c) {
  if (c >= 48 && c <= 57 || c >= 97 && c <= 102 || c >= 65 && c <= 70) {
    return String.fromCharCode(c);
  }
  return false;
}
__name(getHex, "getHex");
function decodeWord(charset, encoding, str) {
  let splitPos = charset.indexOf("*");
  if (splitPos >= 0) {
    charset = charset.substr(0, splitPos);
  }
  encoding = encoding.toUpperCase();
  let byteStr;
  if (encoding === "Q") {
    str = str.replace(/=\s+([0-9a-fA-F])/g, "=$1").replace(/[_\s]/g, " ");
    let buf = textEncoder.encode(str);
    let encodedBytes = [];
    for (let i = 0, len = buf.length; i < len; i++) {
      let c = buf[i];
      if (i <= len - 2 && c === 61) {
        let c1 = getHex(buf[i + 1]);
        let c2 = getHex(buf[i + 2]);
        if (c1 && c2) {
          let c3 = parseInt(c1 + c2, 16);
          encodedBytes.push(c3);
          i += 2;
          continue;
        }
      }
      encodedBytes.push(c);
    }
    byteStr = new ArrayBuffer(encodedBytes.length);
    let dataView = new DataView(byteStr);
    for (let i = 0, len = encodedBytes.length; i < len; i++) {
      dataView.setUint8(i, encodedBytes[i]);
    }
  } else if (encoding === "B") {
    byteStr = decodeBase64(str.replace(/[^a-zA-Z0-9\+\/=]+/g, ""));
  } else {
    byteStr = textEncoder.encode(str);
  }
  return getDecoder(charset).decode(byteStr);
}
__name(decodeWord, "decodeWord");
function decodeWords(str) {
  let joinString = true;
  let done = false;
  while (!done) {
    let result = (str || "").toString().replace(
      /(=\?([^?]+)\?[Bb]\?([^?]*)\?=)\s*(?==\?([^?]+)\?[Bb]\?[^?]*\?=)/g,
      (match2, left, chLeft, encodedLeftStr, chRight) => {
        if (!joinString) {
          return match2;
        }
        if (chLeft === chRight && encodedLeftStr.length % 4 === 0 && !/=$/.test(encodedLeftStr)) {
          return left + "__\0JOIN\0__";
        }
        return match2;
      }
    ).replace(
      /(=\?([^?]+)\?[Qq]\?[^?]*\?=)\s*(?==\?([^?]+)\?[Qq]\?[^?]*\?=)/g,
      (match2, left, chLeft, chRight) => {
        if (!joinString) {
          return match2;
        }
        if (chLeft === chRight) {
          return left + "__\0JOIN\0__";
        }
        return match2;
      }
    ).replace(/(\?=)?__\x00JOIN\x00__(=\?([^?]+)\?[QqBb]\?)?/g, "").replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, "$1").replace(
      /=\?([\w_\-*]+)\?([QqBb])\?([^?]*)\?=/g,
      (m, charset, encoding, text2) => decodeWord(charset, encoding, text2)
    );
    if (joinString && result.indexOf("\uFFFD") >= 0) {
      joinString = false;
    } else {
      return result;
    }
  }
}
__name(decodeWords, "decodeWords");
function decodeURIComponentWithCharset(encodedStr, charset) {
  charset = charset || "utf-8";
  let encodedBytes = [];
  for (let i = 0; i < encodedStr.length; i++) {
    let c = encodedStr.charAt(i);
    if (c === "%" && /^[a-f0-9]{2}/i.test(encodedStr.substr(i + 1, 2))) {
      let byte = encodedStr.substr(i + 1, 2);
      i += 2;
      encodedBytes.push(parseInt(byte, 16));
    } else if (c.charCodeAt(0) > 126) {
      c = textEncoder.encode(c);
      for (let j = 0; j < c.length; j++) {
        encodedBytes.push(c[j]);
      }
    } else {
      encodedBytes.push(c.charCodeAt(0));
    }
  }
  const byteStr = new ArrayBuffer(encodedBytes.length);
  const dataView = new DataView(byteStr);
  for (let i = 0, len = encodedBytes.length; i < len; i++) {
    dataView.setUint8(i, encodedBytes[i]);
  }
  return getDecoder(charset).decode(byteStr);
}
__name(decodeURIComponentWithCharset, "decodeURIComponentWithCharset");
function decodeParameterValueContinuations(header) {
  let paramKeys = /* @__PURE__ */ new Map();
  Object.keys(header.params).forEach((key) => {
    let match2 = key.match(/\*((\d+)\*?)?$/);
    if (!match2) {
      return;
    }
    let actualKey = key.substr(0, match2.index).toLowerCase();
    let nr = Number(match2[2]) || 0;
    let paramVal;
    if (!paramKeys.has(actualKey)) {
      paramVal = {
        charset: false,
        values: []
      };
      paramKeys.set(actualKey, paramVal);
    } else {
      paramVal = paramKeys.get(actualKey);
    }
    let value = header.params[key];
    if (nr === 0 && match2[0].charAt(match2[0].length - 1) === "*" && (match2 = value.match(/^([^']*)'[^']*'(.*)$/))) {
      paramVal.charset = match2[1] || "utf-8";
      value = match2[2];
    }
    paramVal.values.push({ nr, value });
    delete header.params[key];
  });
  paramKeys.forEach((paramVal, key) => {
    header.params[key] = decodeURIComponentWithCharset(
      paramVal.values.sort((a, b) => a.nr - b.nr).map((a) => a.value).join(""),
      paramVal.charset
    );
  });
}
__name(decodeParameterValueContinuations, "decodeParameterValueContinuations");

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/pass-through-decoder.js
var PassThroughDecoder = class {
  static {
    __name(this, "PassThroughDecoder");
  }
  constructor() {
    this.chunks = [];
  }
  update(line) {
    this.chunks.push(line);
    this.chunks.push("\n");
  }
  finalize() {
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
};

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/base64-decoder.js
var Base64Decoder = class {
  static {
    __name(this, "Base64Decoder");
  }
  constructor(opts) {
    opts = opts || {};
    this.decoder = opts.decoder || new TextDecoder();
    this.maxChunkSize = 100 * 1024;
    this.chunks = [];
    this.remainder = "";
  }
  update(buffer) {
    let str = this.decoder.decode(buffer);
    str = str.replace(/[^a-zA-Z0-9+\/]+/g, "");
    this.remainder += str;
    if (this.remainder.length >= this.maxChunkSize) {
      let allowedBytes = Math.floor(this.remainder.length / 4) * 4;
      let base64Str;
      if (allowedBytes === this.remainder.length) {
        base64Str = this.remainder;
        this.remainder = "";
      } else {
        base64Str = this.remainder.substr(0, allowedBytes);
        this.remainder = this.remainder.substr(allowedBytes);
      }
      if (base64Str.length) {
        this.chunks.push(decodeBase64(base64Str));
      }
    }
  }
  finalize() {
    if (this.remainder && !/^=+$/.test(this.remainder)) {
      this.chunks.push(decodeBase64(this.remainder));
    }
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
};

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/qp-decoder.js
var VALID_QP_REGEX = /^=[a-f0-9]{2}$/i;
var QP_SPLIT_REGEX = /(?==[a-f0-9]{2})/i;
var SOFT_LINE_BREAK_REGEX = /=\r?\n/g;
var PARTIAL_QP_ENDING_REGEX = /=[a-fA-F0-9]?$/;
var QPDecoder = class {
  static {
    __name(this, "QPDecoder");
  }
  constructor(opts) {
    opts = opts || {};
    this.decoder = opts.decoder || new TextDecoder();
    this.maxChunkSize = 100 * 1024;
    this.remainder = "";
    this.chunks = [];
  }
  decodeQPBytes(encodedBytes) {
    let buf = new ArrayBuffer(encodedBytes.length);
    let dataView = new DataView(buf);
    for (let i = 0, len = encodedBytes.length; i < len; i++) {
      dataView.setUint8(i, parseInt(encodedBytes[i], 16));
    }
    return buf;
  }
  decodeChunks(str) {
    str = str.replace(SOFT_LINE_BREAK_REGEX, "");
    let list = str.split(QP_SPLIT_REGEX);
    let encodedBytes = [];
    for (let part of list) {
      if (part.charAt(0) !== "=") {
        if (encodedBytes.length) {
          this.chunks.push(this.decodeQPBytes(encodedBytes));
          encodedBytes = [];
        }
        this.chunks.push(part);
        continue;
      }
      if (part.length === 3) {
        if (VALID_QP_REGEX.test(part)) {
          encodedBytes.push(part.substr(1));
        } else {
          if (encodedBytes.length) {
            this.chunks.push(this.decodeQPBytes(encodedBytes));
            encodedBytes = [];
          }
          this.chunks.push(part);
        }
        continue;
      }
      if (part.length > 3) {
        const firstThree = part.substr(0, 3);
        if (VALID_QP_REGEX.test(firstThree)) {
          encodedBytes.push(part.substr(1, 2));
          this.chunks.push(this.decodeQPBytes(encodedBytes));
          encodedBytes = [];
          part = part.substr(3);
          this.chunks.push(part);
        } else {
          if (encodedBytes.length) {
            this.chunks.push(this.decodeQPBytes(encodedBytes));
            encodedBytes = [];
          }
          this.chunks.push(part);
        }
      }
    }
    if (encodedBytes.length) {
      this.chunks.push(this.decodeQPBytes(encodedBytes));
    }
  }
  update(buffer) {
    let str = this.decoder.decode(buffer) + "\n";
    str = this.remainder + str;
    if (str.length < this.maxChunkSize) {
      this.remainder = str;
      return;
    }
    this.remainder = "";
    let partialEnding = str.match(PARTIAL_QP_ENDING_REGEX);
    if (partialEnding) {
      if (partialEnding.index === 0) {
        this.remainder = str;
        return;
      }
      this.remainder = str.substr(partialEnding.index);
      str = str.substr(0, partialEnding.index);
    }
    this.decodeChunks(str);
  }
  finalize() {
    if (this.remainder.length) {
      this.decodeChunks(this.remainder);
      this.remainder = "";
    }
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
};

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/mime-node.js
var defaultDecoder = getDecoder();
var MimeNode = class {
  static {
    __name(this, "MimeNode");
  }
  constructor(options) {
    this.options = options || {};
    this.postalMime = this.options.postalMime;
    this.root = !!this.options.parentNode;
    this.childNodes = [];
    if (this.options.parentNode) {
      this.parentNode = this.options.parentNode;
      this.depth = this.parentNode.depth + 1;
      if (this.depth > this.options.maxNestingDepth) {
        throw new Error(`Maximum MIME nesting depth of ${this.options.maxNestingDepth} levels exceeded`);
      }
      this.options.parentNode.childNodes.push(this);
    } else {
      this.depth = 0;
    }
    this.state = "header";
    this.headerLines = [];
    this.headerSize = 0;
    const parentMultipartType = this.options.parentMultipartType || null;
    const defaultContentType = parentMultipartType === "digest" ? "message/rfc822" : "text/plain";
    this.contentType = {
      value: defaultContentType,
      default: true
    };
    this.contentTransferEncoding = {
      value: "8bit"
    };
    this.contentDisposition = {
      value: ""
    };
    this.headers = [];
    this.contentDecoder = false;
  }
  setupContentDecoder(transferEncoding) {
    if (/base64/i.test(transferEncoding)) {
      this.contentDecoder = new Base64Decoder();
    } else if (/quoted-printable/i.test(transferEncoding)) {
      this.contentDecoder = new QPDecoder({ decoder: getDecoder(this.contentType.parsed.params.charset) });
    } else {
      this.contentDecoder = new PassThroughDecoder();
    }
  }
  async finalize() {
    if (this.state === "finished") {
      return;
    }
    if (this.state === "header") {
      this.processHeaders();
    }
    let boundaries = this.postalMime.boundaries;
    for (let i = boundaries.length - 1; i >= 0; i--) {
      let boundary = boundaries[i];
      if (boundary.node === this) {
        boundaries.splice(i, 1);
        break;
      }
    }
    await this.finalizeChildNodes();
    this.content = this.contentDecoder ? await this.contentDecoder.finalize() : null;
    this.contentDecoder = false;
    this.state = "finished";
  }
  async finalizeChildNodes() {
    for (let childNode of this.childNodes) {
      await childNode.finalize();
    }
  }
  // Strip RFC 822 comments (parenthesized text) from structured header values
  stripComments(str) {
    let result = "";
    let depth = 0;
    let escaped = false;
    let inQuote = false;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charAt(i);
      if (escaped) {
        if (depth === 0) {
          result += chr;
        }
        escaped = false;
        continue;
      }
      if (chr === "\\") {
        escaped = true;
        if (depth === 0) {
          result += chr;
        }
        continue;
      }
      if (chr === '"' && depth === 0) {
        inQuote = !inQuote;
        result += chr;
        continue;
      }
      if (!inQuote) {
        if (chr === "(") {
          depth++;
          continue;
        }
        if (chr === ")" && depth > 0) {
          depth--;
          continue;
        }
      }
      if (depth === 0) {
        result += chr;
      }
    }
    return result;
  }
  parseStructuredHeader(str) {
    str = this.stripComments(str);
    let response = {
      value: false,
      params: {}
    };
    let key = false;
    let value = "";
    let stage = "value";
    let quote = false;
    let escaped = false;
    let chr;
    for (let i = 0, len = str.length; i < len; i++) {
      chr = str.charAt(i);
      switch (stage) {
        case "key":
          if (chr === "=") {
            key = value.trim().toLowerCase();
            stage = "value";
            value = "";
            break;
          }
          value += chr;
          break;
        case "value":
          if (escaped) {
            value += chr;
          } else if (chr === "\\") {
            escaped = true;
            continue;
          } else if (quote && chr === quote) {
            quote = false;
          } else if (!quote && chr === '"') {
            quote = chr;
          } else if (!quote && chr === ";") {
            if (key === false) {
              response.value = value.trim();
            } else {
              response.params[key] = value.trim();
            }
            stage = "key";
            value = "";
          } else {
            value += chr;
          }
          escaped = false;
          break;
      }
    }
    value = value.trim();
    if (stage === "value") {
      if (key === false) {
        response.value = value;
      } else {
        response.params[key] = value;
      }
    } else if (value) {
      response.params[value.toLowerCase()] = "";
    }
    if (response.value) {
      response.value = response.value.toLowerCase();
    }
    decodeParameterValueContinuations(response);
    return response;
  }
  decodeFlowedText(str, delSp) {
    return str.split(/\r?\n/).reduce((previousValue, currentValue) => {
      if (previousValue.endsWith(" ") && previousValue !== "-- " && !previousValue.endsWith("\n-- ")) {
        if (delSp) {
          return previousValue.slice(0, -1) + currentValue;
        } else {
          return previousValue + currentValue;
        }
      } else {
        return previousValue + "\n" + currentValue;
      }
    }).replace(/^ /gm, "");
  }
  getTextContent() {
    if (!this.content) {
      return "";
    }
    let str = getDecoder(this.contentType.parsed.params.charset).decode(this.content);
    if (/^flowed$/i.test(this.contentType.parsed.params.format)) {
      str = this.decodeFlowedText(str, /^yes$/i.test(this.contentType.parsed.params.delsp));
    }
    return str;
  }
  processHeaders() {
    for (let i = this.headerLines.length - 1; i >= 0; i--) {
      let line = this.headerLines[i];
      if (i && /^\s/.test(line)) {
        this.headerLines[i - 1] += "\n" + line;
        this.headerLines.splice(i, 1);
      }
    }
    this.rawHeaderLines = [];
    for (let i = this.headerLines.length - 1; i >= 0; i--) {
      let rawLine = this.headerLines[i];
      let sep = rawLine.indexOf(":");
      let rawKey = sep < 0 ? rawLine.trim() : rawLine.substr(0, sep).trim();
      this.rawHeaderLines.push({
        key: rawKey.toLowerCase(),
        line: rawLine
      });
      let normalizedLine = rawLine.replace(/\s+/g, " ");
      sep = normalizedLine.indexOf(":");
      let key = sep < 0 ? normalizedLine.trim() : normalizedLine.substr(0, sep).trim();
      let value = sep < 0 ? "" : normalizedLine.substr(sep + 1).trim();
      this.headers.push({ key: key.toLowerCase(), originalKey: key, value });
      switch (key.toLowerCase()) {
        case "content-type":
          if (this.contentType.default) {
            this.contentType = { value, parsed: {} };
          }
          break;
        case "content-transfer-encoding":
          this.contentTransferEncoding = { value, parsed: {} };
          break;
        case "content-disposition":
          this.contentDisposition = { value, parsed: {} };
          break;
        case "content-id":
          this.contentId = value;
          break;
        case "content-description":
          this.contentDescription = value;
          break;
      }
    }
    this.contentType.parsed = this.parseStructuredHeader(this.contentType.value);
    this.contentType.multipart = /^multipart\//i.test(this.contentType.parsed.value) ? this.contentType.parsed.value.substr(this.contentType.parsed.value.indexOf("/") + 1) : false;
    if (this.contentType.multipart && this.contentType.parsed.params.boundary) {
      this.postalMime.boundaries.push({
        value: textEncoder.encode(this.contentType.parsed.params.boundary),
        node: this
      });
    }
    this.contentDisposition.parsed = this.parseStructuredHeader(this.contentDisposition.value);
    this.contentTransferEncoding.encoding = this.contentTransferEncoding.value.toLowerCase().split(/[^\w-]/).shift();
    this.setupContentDecoder(this.contentTransferEncoding.encoding);
  }
  feed(line) {
    switch (this.state) {
      case "header":
        if (!line.length) {
          this.state = "body";
          return this.processHeaders();
        }
        this.headerSize += line.length;
        if (this.headerSize > this.options.maxHeadersSize) {
          let error = new Error(`Maximum header size of ${this.options.maxHeadersSize} bytes exceeded`);
          throw error;
        }
        this.headerLines.push(defaultDecoder.decode(line));
        break;
      case "body": {
        this.contentDecoder.update(line);
      }
    }
  }
};

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/html-entities.js
var htmlEntities = {
  "&AElig": "\xC6",
  "&AElig;": "\xC6",
  "&AMP": "&",
  "&AMP;": "&",
  "&Aacute": "\xC1",
  "&Aacute;": "\xC1",
  "&Abreve;": "\u0102",
  "&Acirc": "\xC2",
  "&Acirc;": "\xC2",
  "&Acy;": "\u0410",
  "&Afr;": "\u{1D504}",
  "&Agrave": "\xC0",
  "&Agrave;": "\xC0",
  "&Alpha;": "\u0391",
  "&Amacr;": "\u0100",
  "&And;": "\u2A53",
  "&Aogon;": "\u0104",
  "&Aopf;": "\u{1D538}",
  "&ApplyFunction;": "\u2061",
  "&Aring": "\xC5",
  "&Aring;": "\xC5",
  "&Ascr;": "\u{1D49C}",
  "&Assign;": "\u2254",
  "&Atilde": "\xC3",
  "&Atilde;": "\xC3",
  "&Auml": "\xC4",
  "&Auml;": "\xC4",
  "&Backslash;": "\u2216",
  "&Barv;": "\u2AE7",
  "&Barwed;": "\u2306",
  "&Bcy;": "\u0411",
  "&Because;": "\u2235",
  "&Bernoullis;": "\u212C",
  "&Beta;": "\u0392",
  "&Bfr;": "\u{1D505}",
  "&Bopf;": "\u{1D539}",
  "&Breve;": "\u02D8",
  "&Bscr;": "\u212C",
  "&Bumpeq;": "\u224E",
  "&CHcy;": "\u0427",
  "&COPY": "\xA9",
  "&COPY;": "\xA9",
  "&Cacute;": "\u0106",
  "&Cap;": "\u22D2",
  "&CapitalDifferentialD;": "\u2145",
  "&Cayleys;": "\u212D",
  "&Ccaron;": "\u010C",
  "&Ccedil": "\xC7",
  "&Ccedil;": "\xC7",
  "&Ccirc;": "\u0108",
  "&Cconint;": "\u2230",
  "&Cdot;": "\u010A",
  "&Cedilla;": "\xB8",
  "&CenterDot;": "\xB7",
  "&Cfr;": "\u212D",
  "&Chi;": "\u03A7",
  "&CircleDot;": "\u2299",
  "&CircleMinus;": "\u2296",
  "&CirclePlus;": "\u2295",
  "&CircleTimes;": "\u2297",
  "&ClockwiseContourIntegral;": "\u2232",
  "&CloseCurlyDoubleQuote;": "\u201D",
  "&CloseCurlyQuote;": "\u2019",
  "&Colon;": "\u2237",
  "&Colone;": "\u2A74",
  "&Congruent;": "\u2261",
  "&Conint;": "\u222F",
  "&ContourIntegral;": "\u222E",
  "&Copf;": "\u2102",
  "&Coproduct;": "\u2210",
  "&CounterClockwiseContourIntegral;": "\u2233",
  "&Cross;": "\u2A2F",
  "&Cscr;": "\u{1D49E}",
  "&Cup;": "\u22D3",
  "&CupCap;": "\u224D",
  "&DD;": "\u2145",
  "&DDotrahd;": "\u2911",
  "&DJcy;": "\u0402",
  "&DScy;": "\u0405",
  "&DZcy;": "\u040F",
  "&Dagger;": "\u2021",
  "&Darr;": "\u21A1",
  "&Dashv;": "\u2AE4",
  "&Dcaron;": "\u010E",
  "&Dcy;": "\u0414",
  "&Del;": "\u2207",
  "&Delta;": "\u0394",
  "&Dfr;": "\u{1D507}",
  "&DiacriticalAcute;": "\xB4",
  "&DiacriticalDot;": "\u02D9",
  "&DiacriticalDoubleAcute;": "\u02DD",
  "&DiacriticalGrave;": "`",
  "&DiacriticalTilde;": "\u02DC",
  "&Diamond;": "\u22C4",
  "&DifferentialD;": "\u2146",
  "&Dopf;": "\u{1D53B}",
  "&Dot;": "\xA8",
  "&DotDot;": "\u20DC",
  "&DotEqual;": "\u2250",
  "&DoubleContourIntegral;": "\u222F",
  "&DoubleDot;": "\xA8",
  "&DoubleDownArrow;": "\u21D3",
  "&DoubleLeftArrow;": "\u21D0",
  "&DoubleLeftRightArrow;": "\u21D4",
  "&DoubleLeftTee;": "\u2AE4",
  "&DoubleLongLeftArrow;": "\u27F8",
  "&DoubleLongLeftRightArrow;": "\u27FA",
  "&DoubleLongRightArrow;": "\u27F9",
  "&DoubleRightArrow;": "\u21D2",
  "&DoubleRightTee;": "\u22A8",
  "&DoubleUpArrow;": "\u21D1",
  "&DoubleUpDownArrow;": "\u21D5",
  "&DoubleVerticalBar;": "\u2225",
  "&DownArrow;": "\u2193",
  "&DownArrowBar;": "\u2913",
  "&DownArrowUpArrow;": "\u21F5",
  "&DownBreve;": "\u0311",
  "&DownLeftRightVector;": "\u2950",
  "&DownLeftTeeVector;": "\u295E",
  "&DownLeftVector;": "\u21BD",
  "&DownLeftVectorBar;": "\u2956",
  "&DownRightTeeVector;": "\u295F",
  "&DownRightVector;": "\u21C1",
  "&DownRightVectorBar;": "\u2957",
  "&DownTee;": "\u22A4",
  "&DownTeeArrow;": "\u21A7",
  "&Downarrow;": "\u21D3",
  "&Dscr;": "\u{1D49F}",
  "&Dstrok;": "\u0110",
  "&ENG;": "\u014A",
  "&ETH": "\xD0",
  "&ETH;": "\xD0",
  "&Eacute": "\xC9",
  "&Eacute;": "\xC9",
  "&Ecaron;": "\u011A",
  "&Ecirc": "\xCA",
  "&Ecirc;": "\xCA",
  "&Ecy;": "\u042D",
  "&Edot;": "\u0116",
  "&Efr;": "\u{1D508}",
  "&Egrave": "\xC8",
  "&Egrave;": "\xC8",
  "&Element;": "\u2208",
  "&Emacr;": "\u0112",
  "&EmptySmallSquare;": "\u25FB",
  "&EmptyVerySmallSquare;": "\u25AB",
  "&Eogon;": "\u0118",
  "&Eopf;": "\u{1D53C}",
  "&Epsilon;": "\u0395",
  "&Equal;": "\u2A75",
  "&EqualTilde;": "\u2242",
  "&Equilibrium;": "\u21CC",
  "&Escr;": "\u2130",
  "&Esim;": "\u2A73",
  "&Eta;": "\u0397",
  "&Euml": "\xCB",
  "&Euml;": "\xCB",
  "&Exists;": "\u2203",
  "&ExponentialE;": "\u2147",
  "&Fcy;": "\u0424",
  "&Ffr;": "\u{1D509}",
  "&FilledSmallSquare;": "\u25FC",
  "&FilledVerySmallSquare;": "\u25AA",
  "&Fopf;": "\u{1D53D}",
  "&ForAll;": "\u2200",
  "&Fouriertrf;": "\u2131",
  "&Fscr;": "\u2131",
  "&GJcy;": "\u0403",
  "&GT": ">",
  "&GT;": ">",
  "&Gamma;": "\u0393",
  "&Gammad;": "\u03DC",
  "&Gbreve;": "\u011E",
  "&Gcedil;": "\u0122",
  "&Gcirc;": "\u011C",
  "&Gcy;": "\u0413",
  "&Gdot;": "\u0120",
  "&Gfr;": "\u{1D50A}",
  "&Gg;": "\u22D9",
  "&Gopf;": "\u{1D53E}",
  "&GreaterEqual;": "\u2265",
  "&GreaterEqualLess;": "\u22DB",
  "&GreaterFullEqual;": "\u2267",
  "&GreaterGreater;": "\u2AA2",
  "&GreaterLess;": "\u2277",
  "&GreaterSlantEqual;": "\u2A7E",
  "&GreaterTilde;": "\u2273",
  "&Gscr;": "\u{1D4A2}",
  "&Gt;": "\u226B",
  "&HARDcy;": "\u042A",
  "&Hacek;": "\u02C7",
  "&Hat;": "^",
  "&Hcirc;": "\u0124",
  "&Hfr;": "\u210C",
  "&HilbertSpace;": "\u210B",
  "&Hopf;": "\u210D",
  "&HorizontalLine;": "\u2500",
  "&Hscr;": "\u210B",
  "&Hstrok;": "\u0126",
  "&HumpDownHump;": "\u224E",
  "&HumpEqual;": "\u224F",
  "&IEcy;": "\u0415",
  "&IJlig;": "\u0132",
  "&IOcy;": "\u0401",
  "&Iacute": "\xCD",
  "&Iacute;": "\xCD",
  "&Icirc": "\xCE",
  "&Icirc;": "\xCE",
  "&Icy;": "\u0418",
  "&Idot;": "\u0130",
  "&Ifr;": "\u2111",
  "&Igrave": "\xCC",
  "&Igrave;": "\xCC",
  "&Im;": "\u2111",
  "&Imacr;": "\u012A",
  "&ImaginaryI;": "\u2148",
  "&Implies;": "\u21D2",
  "&Int;": "\u222C",
  "&Integral;": "\u222B",
  "&Intersection;": "\u22C2",
  "&InvisibleComma;": "\u2063",
  "&InvisibleTimes;": "\u2062",
  "&Iogon;": "\u012E",
  "&Iopf;": "\u{1D540}",
  "&Iota;": "\u0399",
  "&Iscr;": "\u2110",
  "&Itilde;": "\u0128",
  "&Iukcy;": "\u0406",
  "&Iuml": "\xCF",
  "&Iuml;": "\xCF",
  "&Jcirc;": "\u0134",
  "&Jcy;": "\u0419",
  "&Jfr;": "\u{1D50D}",
  "&Jopf;": "\u{1D541}",
  "&Jscr;": "\u{1D4A5}",
  "&Jsercy;": "\u0408",
  "&Jukcy;": "\u0404",
  "&KHcy;": "\u0425",
  "&KJcy;": "\u040C",
  "&Kappa;": "\u039A",
  "&Kcedil;": "\u0136",
  "&Kcy;": "\u041A",
  "&Kfr;": "\u{1D50E}",
  "&Kopf;": "\u{1D542}",
  "&Kscr;": "\u{1D4A6}",
  "&LJcy;": "\u0409",
  "&LT": "<",
  "&LT;": "<",
  "&Lacute;": "\u0139",
  "&Lambda;": "\u039B",
  "&Lang;": "\u27EA",
  "&Laplacetrf;": "\u2112",
  "&Larr;": "\u219E",
  "&Lcaron;": "\u013D",
  "&Lcedil;": "\u013B",
  "&Lcy;": "\u041B",
  "&LeftAngleBracket;": "\u27E8",
  "&LeftArrow;": "\u2190",
  "&LeftArrowBar;": "\u21E4",
  "&LeftArrowRightArrow;": "\u21C6",
  "&LeftCeiling;": "\u2308",
  "&LeftDoubleBracket;": "\u27E6",
  "&LeftDownTeeVector;": "\u2961",
  "&LeftDownVector;": "\u21C3",
  "&LeftDownVectorBar;": "\u2959",
  "&LeftFloor;": "\u230A",
  "&LeftRightArrow;": "\u2194",
  "&LeftRightVector;": "\u294E",
  "&LeftTee;": "\u22A3",
  "&LeftTeeArrow;": "\u21A4",
  "&LeftTeeVector;": "\u295A",
  "&LeftTriangle;": "\u22B2",
  "&LeftTriangleBar;": "\u29CF",
  "&LeftTriangleEqual;": "\u22B4",
  "&LeftUpDownVector;": "\u2951",
  "&LeftUpTeeVector;": "\u2960",
  "&LeftUpVector;": "\u21BF",
  "&LeftUpVectorBar;": "\u2958",
  "&LeftVector;": "\u21BC",
  "&LeftVectorBar;": "\u2952",
  "&Leftarrow;": "\u21D0",
  "&Leftrightarrow;": "\u21D4",
  "&LessEqualGreater;": "\u22DA",
  "&LessFullEqual;": "\u2266",
  "&LessGreater;": "\u2276",
  "&LessLess;": "\u2AA1",
  "&LessSlantEqual;": "\u2A7D",
  "&LessTilde;": "\u2272",
  "&Lfr;": "\u{1D50F}",
  "&Ll;": "\u22D8",
  "&Lleftarrow;": "\u21DA",
  "&Lmidot;": "\u013F",
  "&LongLeftArrow;": "\u27F5",
  "&LongLeftRightArrow;": "\u27F7",
  "&LongRightArrow;": "\u27F6",
  "&Longleftarrow;": "\u27F8",
  "&Longleftrightarrow;": "\u27FA",
  "&Longrightarrow;": "\u27F9",
  "&Lopf;": "\u{1D543}",
  "&LowerLeftArrow;": "\u2199",
  "&LowerRightArrow;": "\u2198",
  "&Lscr;": "\u2112",
  "&Lsh;": "\u21B0",
  "&Lstrok;": "\u0141",
  "&Lt;": "\u226A",
  "&Map;": "\u2905",
  "&Mcy;": "\u041C",
  "&MediumSpace;": "\u205F",
  "&Mellintrf;": "\u2133",
  "&Mfr;": "\u{1D510}",
  "&MinusPlus;": "\u2213",
  "&Mopf;": "\u{1D544}",
  "&Mscr;": "\u2133",
  "&Mu;": "\u039C",
  "&NJcy;": "\u040A",
  "&Nacute;": "\u0143",
  "&Ncaron;": "\u0147",
  "&Ncedil;": "\u0145",
  "&Ncy;": "\u041D",
  "&NegativeMediumSpace;": "\u200B",
  "&NegativeThickSpace;": "\u200B",
  "&NegativeThinSpace;": "\u200B",
  "&NegativeVeryThinSpace;": "\u200B",
  "&NestedGreaterGreater;": "\u226B",
  "&NestedLessLess;": "\u226A",
  "&NewLine;": "\n",
  "&Nfr;": "\u{1D511}",
  "&NoBreak;": "\u2060",
  "&NonBreakingSpace;": "\xA0",
  "&Nopf;": "\u2115",
  "&Not;": "\u2AEC",
  "&NotCongruent;": "\u2262",
  "&NotCupCap;": "\u226D",
  "&NotDoubleVerticalBar;": "\u2226",
  "&NotElement;": "\u2209",
  "&NotEqual;": "\u2260",
  "&NotEqualTilde;": "\u2242\u0338",
  "&NotExists;": "\u2204",
  "&NotGreater;": "\u226F",
  "&NotGreaterEqual;": "\u2271",
  "&NotGreaterFullEqual;": "\u2267\u0338",
  "&NotGreaterGreater;": "\u226B\u0338",
  "&NotGreaterLess;": "\u2279",
  "&NotGreaterSlantEqual;": "\u2A7E\u0338",
  "&NotGreaterTilde;": "\u2275",
  "&NotHumpDownHump;": "\u224E\u0338",
  "&NotHumpEqual;": "\u224F\u0338",
  "&NotLeftTriangle;": "\u22EA",
  "&NotLeftTriangleBar;": "\u29CF\u0338",
  "&NotLeftTriangleEqual;": "\u22EC",
  "&NotLess;": "\u226E",
  "&NotLessEqual;": "\u2270",
  "&NotLessGreater;": "\u2278",
  "&NotLessLess;": "\u226A\u0338",
  "&NotLessSlantEqual;": "\u2A7D\u0338",
  "&NotLessTilde;": "\u2274",
  "&NotNestedGreaterGreater;": "\u2AA2\u0338",
  "&NotNestedLessLess;": "\u2AA1\u0338",
  "&NotPrecedes;": "\u2280",
  "&NotPrecedesEqual;": "\u2AAF\u0338",
  "&NotPrecedesSlantEqual;": "\u22E0",
  "&NotReverseElement;": "\u220C",
  "&NotRightTriangle;": "\u22EB",
  "&NotRightTriangleBar;": "\u29D0\u0338",
  "&NotRightTriangleEqual;": "\u22ED",
  "&NotSquareSubset;": "\u228F\u0338",
  "&NotSquareSubsetEqual;": "\u22E2",
  "&NotSquareSuperset;": "\u2290\u0338",
  "&NotSquareSupersetEqual;": "\u22E3",
  "&NotSubset;": "\u2282\u20D2",
  "&NotSubsetEqual;": "\u2288",
  "&NotSucceeds;": "\u2281",
  "&NotSucceedsEqual;": "\u2AB0\u0338",
  "&NotSucceedsSlantEqual;": "\u22E1",
  "&NotSucceedsTilde;": "\u227F\u0338",
  "&NotSuperset;": "\u2283\u20D2",
  "&NotSupersetEqual;": "\u2289",
  "&NotTilde;": "\u2241",
  "&NotTildeEqual;": "\u2244",
  "&NotTildeFullEqual;": "\u2247",
  "&NotTildeTilde;": "\u2249",
  "&NotVerticalBar;": "\u2224",
  "&Nscr;": "\u{1D4A9}",
  "&Ntilde": "\xD1",
  "&Ntilde;": "\xD1",
  "&Nu;": "\u039D",
  "&OElig;": "\u0152",
  "&Oacute": "\xD3",
  "&Oacute;": "\xD3",
  "&Ocirc": "\xD4",
  "&Ocirc;": "\xD4",
  "&Ocy;": "\u041E",
  "&Odblac;": "\u0150",
  "&Ofr;": "\u{1D512}",
  "&Ograve": "\xD2",
  "&Ograve;": "\xD2",
  "&Omacr;": "\u014C",
  "&Omega;": "\u03A9",
  "&Omicron;": "\u039F",
  "&Oopf;": "\u{1D546}",
  "&OpenCurlyDoubleQuote;": "\u201C",
  "&OpenCurlyQuote;": "\u2018",
  "&Or;": "\u2A54",
  "&Oscr;": "\u{1D4AA}",
  "&Oslash": "\xD8",
  "&Oslash;": "\xD8",
  "&Otilde": "\xD5",
  "&Otilde;": "\xD5",
  "&Otimes;": "\u2A37",
  "&Ouml": "\xD6",
  "&Ouml;": "\xD6",
  "&OverBar;": "\u203E",
  "&OverBrace;": "\u23DE",
  "&OverBracket;": "\u23B4",
  "&OverParenthesis;": "\u23DC",
  "&PartialD;": "\u2202",
  "&Pcy;": "\u041F",
  "&Pfr;": "\u{1D513}",
  "&Phi;": "\u03A6",
  "&Pi;": "\u03A0",
  "&PlusMinus;": "\xB1",
  "&Poincareplane;": "\u210C",
  "&Popf;": "\u2119",
  "&Pr;": "\u2ABB",
  "&Precedes;": "\u227A",
  "&PrecedesEqual;": "\u2AAF",
  "&PrecedesSlantEqual;": "\u227C",
  "&PrecedesTilde;": "\u227E",
  "&Prime;": "\u2033",
  "&Product;": "\u220F",
  "&Proportion;": "\u2237",
  "&Proportional;": "\u221D",
  "&Pscr;": "\u{1D4AB}",
  "&Psi;": "\u03A8",
  "&QUOT": '"',
  "&QUOT;": '"',
  "&Qfr;": "\u{1D514}",
  "&Qopf;": "\u211A",
  "&Qscr;": "\u{1D4AC}",
  "&RBarr;": "\u2910",
  "&REG": "\xAE",
  "&REG;": "\xAE",
  "&Racute;": "\u0154",
  "&Rang;": "\u27EB",
  "&Rarr;": "\u21A0",
  "&Rarrtl;": "\u2916",
  "&Rcaron;": "\u0158",
  "&Rcedil;": "\u0156",
  "&Rcy;": "\u0420",
  "&Re;": "\u211C",
  "&ReverseElement;": "\u220B",
  "&ReverseEquilibrium;": "\u21CB",
  "&ReverseUpEquilibrium;": "\u296F",
  "&Rfr;": "\u211C",
  "&Rho;": "\u03A1",
  "&RightAngleBracket;": "\u27E9",
  "&RightArrow;": "\u2192",
  "&RightArrowBar;": "\u21E5",
  "&RightArrowLeftArrow;": "\u21C4",
  "&RightCeiling;": "\u2309",
  "&RightDoubleBracket;": "\u27E7",
  "&RightDownTeeVector;": "\u295D",
  "&RightDownVector;": "\u21C2",
  "&RightDownVectorBar;": "\u2955",
  "&RightFloor;": "\u230B",
  "&RightTee;": "\u22A2",
  "&RightTeeArrow;": "\u21A6",
  "&RightTeeVector;": "\u295B",
  "&RightTriangle;": "\u22B3",
  "&RightTriangleBar;": "\u29D0",
  "&RightTriangleEqual;": "\u22B5",
  "&RightUpDownVector;": "\u294F",
  "&RightUpTeeVector;": "\u295C",
  "&RightUpVector;": "\u21BE",
  "&RightUpVectorBar;": "\u2954",
  "&RightVector;": "\u21C0",
  "&RightVectorBar;": "\u2953",
  "&Rightarrow;": "\u21D2",
  "&Ropf;": "\u211D",
  "&RoundImplies;": "\u2970",
  "&Rrightarrow;": "\u21DB",
  "&Rscr;": "\u211B",
  "&Rsh;": "\u21B1",
  "&RuleDelayed;": "\u29F4",
  "&SHCHcy;": "\u0429",
  "&SHcy;": "\u0428",
  "&SOFTcy;": "\u042C",
  "&Sacute;": "\u015A",
  "&Sc;": "\u2ABC",
  "&Scaron;": "\u0160",
  "&Scedil;": "\u015E",
  "&Scirc;": "\u015C",
  "&Scy;": "\u0421",
  "&Sfr;": "\u{1D516}",
  "&ShortDownArrow;": "\u2193",
  "&ShortLeftArrow;": "\u2190",
  "&ShortRightArrow;": "\u2192",
  "&ShortUpArrow;": "\u2191",
  "&Sigma;": "\u03A3",
  "&SmallCircle;": "\u2218",
  "&Sopf;": "\u{1D54A}",
  "&Sqrt;": "\u221A",
  "&Square;": "\u25A1",
  "&SquareIntersection;": "\u2293",
  "&SquareSubset;": "\u228F",
  "&SquareSubsetEqual;": "\u2291",
  "&SquareSuperset;": "\u2290",
  "&SquareSupersetEqual;": "\u2292",
  "&SquareUnion;": "\u2294",
  "&Sscr;": "\u{1D4AE}",
  "&Star;": "\u22C6",
  "&Sub;": "\u22D0",
  "&Subset;": "\u22D0",
  "&SubsetEqual;": "\u2286",
  "&Succeeds;": "\u227B",
  "&SucceedsEqual;": "\u2AB0",
  "&SucceedsSlantEqual;": "\u227D",
  "&SucceedsTilde;": "\u227F",
  "&SuchThat;": "\u220B",
  "&Sum;": "\u2211",
  "&Sup;": "\u22D1",
  "&Superset;": "\u2283",
  "&SupersetEqual;": "\u2287",
  "&Supset;": "\u22D1",
  "&THORN": "\xDE",
  "&THORN;": "\xDE",
  "&TRADE;": "\u2122",
  "&TSHcy;": "\u040B",
  "&TScy;": "\u0426",
  "&Tab;": "	",
  "&Tau;": "\u03A4",
  "&Tcaron;": "\u0164",
  "&Tcedil;": "\u0162",
  "&Tcy;": "\u0422",
  "&Tfr;": "\u{1D517}",
  "&Therefore;": "\u2234",
  "&Theta;": "\u0398",
  "&ThickSpace;": "\u205F\u200A",
  "&ThinSpace;": "\u2009",
  "&Tilde;": "\u223C",
  "&TildeEqual;": "\u2243",
  "&TildeFullEqual;": "\u2245",
  "&TildeTilde;": "\u2248",
  "&Topf;": "\u{1D54B}",
  "&TripleDot;": "\u20DB",
  "&Tscr;": "\u{1D4AF}",
  "&Tstrok;": "\u0166",
  "&Uacute": "\xDA",
  "&Uacute;": "\xDA",
  "&Uarr;": "\u219F",
  "&Uarrocir;": "\u2949",
  "&Ubrcy;": "\u040E",
  "&Ubreve;": "\u016C",
  "&Ucirc": "\xDB",
  "&Ucirc;": "\xDB",
  "&Ucy;": "\u0423",
  "&Udblac;": "\u0170",
  "&Ufr;": "\u{1D518}",
  "&Ugrave": "\xD9",
  "&Ugrave;": "\xD9",
  "&Umacr;": "\u016A",
  "&UnderBar;": "_",
  "&UnderBrace;": "\u23DF",
  "&UnderBracket;": "\u23B5",
  "&UnderParenthesis;": "\u23DD",
  "&Union;": "\u22C3",
  "&UnionPlus;": "\u228E",
  "&Uogon;": "\u0172",
  "&Uopf;": "\u{1D54C}",
  "&UpArrow;": "\u2191",
  "&UpArrowBar;": "\u2912",
  "&UpArrowDownArrow;": "\u21C5",
  "&UpDownArrow;": "\u2195",
  "&UpEquilibrium;": "\u296E",
  "&UpTee;": "\u22A5",
  "&UpTeeArrow;": "\u21A5",
  "&Uparrow;": "\u21D1",
  "&Updownarrow;": "\u21D5",
  "&UpperLeftArrow;": "\u2196",
  "&UpperRightArrow;": "\u2197",
  "&Upsi;": "\u03D2",
  "&Upsilon;": "\u03A5",
  "&Uring;": "\u016E",
  "&Uscr;": "\u{1D4B0}",
  "&Utilde;": "\u0168",
  "&Uuml": "\xDC",
  "&Uuml;": "\xDC",
  "&VDash;": "\u22AB",
  "&Vbar;": "\u2AEB",
  "&Vcy;": "\u0412",
  "&Vdash;": "\u22A9",
  "&Vdashl;": "\u2AE6",
  "&Vee;": "\u22C1",
  "&Verbar;": "\u2016",
  "&Vert;": "\u2016",
  "&VerticalBar;": "\u2223",
  "&VerticalLine;": "|",
  "&VerticalSeparator;": "\u2758",
  "&VerticalTilde;": "\u2240",
  "&VeryThinSpace;": "\u200A",
  "&Vfr;": "\u{1D519}",
  "&Vopf;": "\u{1D54D}",
  "&Vscr;": "\u{1D4B1}",
  "&Vvdash;": "\u22AA",
  "&Wcirc;": "\u0174",
  "&Wedge;": "\u22C0",
  "&Wfr;": "\u{1D51A}",
  "&Wopf;": "\u{1D54E}",
  "&Wscr;": "\u{1D4B2}",
  "&Xfr;": "\u{1D51B}",
  "&Xi;": "\u039E",
  "&Xopf;": "\u{1D54F}",
  "&Xscr;": "\u{1D4B3}",
  "&YAcy;": "\u042F",
  "&YIcy;": "\u0407",
  "&YUcy;": "\u042E",
  "&Yacute": "\xDD",
  "&Yacute;": "\xDD",
  "&Ycirc;": "\u0176",
  "&Ycy;": "\u042B",
  "&Yfr;": "\u{1D51C}",
  "&Yopf;": "\u{1D550}",
  "&Yscr;": "\u{1D4B4}",
  "&Yuml;": "\u0178",
  "&ZHcy;": "\u0416",
  "&Zacute;": "\u0179",
  "&Zcaron;": "\u017D",
  "&Zcy;": "\u0417",
  "&Zdot;": "\u017B",
  "&ZeroWidthSpace;": "\u200B",
  "&Zeta;": "\u0396",
  "&Zfr;": "\u2128",
  "&Zopf;": "\u2124",
  "&Zscr;": "\u{1D4B5}",
  "&aacute": "\xE1",
  "&aacute;": "\xE1",
  "&abreve;": "\u0103",
  "&ac;": "\u223E",
  "&acE;": "\u223E\u0333",
  "&acd;": "\u223F",
  "&acirc": "\xE2",
  "&acirc;": "\xE2",
  "&acute": "\xB4",
  "&acute;": "\xB4",
  "&acy;": "\u0430",
  "&aelig": "\xE6",
  "&aelig;": "\xE6",
  "&af;": "\u2061",
  "&afr;": "\u{1D51E}",
  "&agrave": "\xE0",
  "&agrave;": "\xE0",
  "&alefsym;": "\u2135",
  "&aleph;": "\u2135",
  "&alpha;": "\u03B1",
  "&amacr;": "\u0101",
  "&amalg;": "\u2A3F",
  "&amp": "&",
  "&amp;": "&",
  "&and;": "\u2227",
  "&andand;": "\u2A55",
  "&andd;": "\u2A5C",
  "&andslope;": "\u2A58",
  "&andv;": "\u2A5A",
  "&ang;": "\u2220",
  "&ange;": "\u29A4",
  "&angle;": "\u2220",
  "&angmsd;": "\u2221",
  "&angmsdaa;": "\u29A8",
  "&angmsdab;": "\u29A9",
  "&angmsdac;": "\u29AA",
  "&angmsdad;": "\u29AB",
  "&angmsdae;": "\u29AC",
  "&angmsdaf;": "\u29AD",
  "&angmsdag;": "\u29AE",
  "&angmsdah;": "\u29AF",
  "&angrt;": "\u221F",
  "&angrtvb;": "\u22BE",
  "&angrtvbd;": "\u299D",
  "&angsph;": "\u2222",
  "&angst;": "\xC5",
  "&angzarr;": "\u237C",
  "&aogon;": "\u0105",
  "&aopf;": "\u{1D552}",
  "&ap;": "\u2248",
  "&apE;": "\u2A70",
  "&apacir;": "\u2A6F",
  "&ape;": "\u224A",
  "&apid;": "\u224B",
  "&apos;": "'",
  "&approx;": "\u2248",
  "&approxeq;": "\u224A",
  "&aring": "\xE5",
  "&aring;": "\xE5",
  "&ascr;": "\u{1D4B6}",
  "&ast;": "*",
  "&asymp;": "\u2248",
  "&asympeq;": "\u224D",
  "&atilde": "\xE3",
  "&atilde;": "\xE3",
  "&auml": "\xE4",
  "&auml;": "\xE4",
  "&awconint;": "\u2233",
  "&awint;": "\u2A11",
  "&bNot;": "\u2AED",
  "&backcong;": "\u224C",
  "&backepsilon;": "\u03F6",
  "&backprime;": "\u2035",
  "&backsim;": "\u223D",
  "&backsimeq;": "\u22CD",
  "&barvee;": "\u22BD",
  "&barwed;": "\u2305",
  "&barwedge;": "\u2305",
  "&bbrk;": "\u23B5",
  "&bbrktbrk;": "\u23B6",
  "&bcong;": "\u224C",
  "&bcy;": "\u0431",
  "&bdquo;": "\u201E",
  "&becaus;": "\u2235",
  "&because;": "\u2235",
  "&bemptyv;": "\u29B0",
  "&bepsi;": "\u03F6",
  "&bernou;": "\u212C",
  "&beta;": "\u03B2",
  "&beth;": "\u2136",
  "&between;": "\u226C",
  "&bfr;": "\u{1D51F}",
  "&bigcap;": "\u22C2",
  "&bigcirc;": "\u25EF",
  "&bigcup;": "\u22C3",
  "&bigodot;": "\u2A00",
  "&bigoplus;": "\u2A01",
  "&bigotimes;": "\u2A02",
  "&bigsqcup;": "\u2A06",
  "&bigstar;": "\u2605",
  "&bigtriangledown;": "\u25BD",
  "&bigtriangleup;": "\u25B3",
  "&biguplus;": "\u2A04",
  "&bigvee;": "\u22C1",
  "&bigwedge;": "\u22C0",
  "&bkarow;": "\u290D",
  "&blacklozenge;": "\u29EB",
  "&blacksquare;": "\u25AA",
  "&blacktriangle;": "\u25B4",
  "&blacktriangledown;": "\u25BE",
  "&blacktriangleleft;": "\u25C2",
  "&blacktriangleright;": "\u25B8",
  "&blank;": "\u2423",
  "&blk12;": "\u2592",
  "&blk14;": "\u2591",
  "&blk34;": "\u2593",
  "&block;": "\u2588",
  "&bne;": "=\u20E5",
  "&bnequiv;": "\u2261\u20E5",
  "&bnot;": "\u2310",
  "&bopf;": "\u{1D553}",
  "&bot;": "\u22A5",
  "&bottom;": "\u22A5",
  "&bowtie;": "\u22C8",
  "&boxDL;": "\u2557",
  "&boxDR;": "\u2554",
  "&boxDl;": "\u2556",
  "&boxDr;": "\u2553",
  "&boxH;": "\u2550",
  "&boxHD;": "\u2566",
  "&boxHU;": "\u2569",
  "&boxHd;": "\u2564",
  "&boxHu;": "\u2567",
  "&boxUL;": "\u255D",
  "&boxUR;": "\u255A",
  "&boxUl;": "\u255C",
  "&boxUr;": "\u2559",
  "&boxV;": "\u2551",
  "&boxVH;": "\u256C",
  "&boxVL;": "\u2563",
  "&boxVR;": "\u2560",
  "&boxVh;": "\u256B",
  "&boxVl;": "\u2562",
  "&boxVr;": "\u255F",
  "&boxbox;": "\u29C9",
  "&boxdL;": "\u2555",
  "&boxdR;": "\u2552",
  "&boxdl;": "\u2510",
  "&boxdr;": "\u250C",
  "&boxh;": "\u2500",
  "&boxhD;": "\u2565",
  "&boxhU;": "\u2568",
  "&boxhd;": "\u252C",
  "&boxhu;": "\u2534",
  "&boxminus;": "\u229F",
  "&boxplus;": "\u229E",
  "&boxtimes;": "\u22A0",
  "&boxuL;": "\u255B",
  "&boxuR;": "\u2558",
  "&boxul;": "\u2518",
  "&boxur;": "\u2514",
  "&boxv;": "\u2502",
  "&boxvH;": "\u256A",
  "&boxvL;": "\u2561",
  "&boxvR;": "\u255E",
  "&boxvh;": "\u253C",
  "&boxvl;": "\u2524",
  "&boxvr;": "\u251C",
  "&bprime;": "\u2035",
  "&breve;": "\u02D8",
  "&brvbar": "\xA6",
  "&brvbar;": "\xA6",
  "&bscr;": "\u{1D4B7}",
  "&bsemi;": "\u204F",
  "&bsim;": "\u223D",
  "&bsime;": "\u22CD",
  "&bsol;": "\\",
  "&bsolb;": "\u29C5",
  "&bsolhsub;": "\u27C8",
  "&bull;": "\u2022",
  "&bullet;": "\u2022",
  "&bump;": "\u224E",
  "&bumpE;": "\u2AAE",
  "&bumpe;": "\u224F",
  "&bumpeq;": "\u224F",
  "&cacute;": "\u0107",
  "&cap;": "\u2229",
  "&capand;": "\u2A44",
  "&capbrcup;": "\u2A49",
  "&capcap;": "\u2A4B",
  "&capcup;": "\u2A47",
  "&capdot;": "\u2A40",
  "&caps;": "\u2229\uFE00",
  "&caret;": "\u2041",
  "&caron;": "\u02C7",
  "&ccaps;": "\u2A4D",
  "&ccaron;": "\u010D",
  "&ccedil": "\xE7",
  "&ccedil;": "\xE7",
  "&ccirc;": "\u0109",
  "&ccups;": "\u2A4C",
  "&ccupssm;": "\u2A50",
  "&cdot;": "\u010B",
  "&cedil": "\xB8",
  "&cedil;": "\xB8",
  "&cemptyv;": "\u29B2",
  "&cent": "\xA2",
  "&cent;": "\xA2",
  "&centerdot;": "\xB7",
  "&cfr;": "\u{1D520}",
  "&chcy;": "\u0447",
  "&check;": "\u2713",
  "&checkmark;": "\u2713",
  "&chi;": "\u03C7",
  "&cir;": "\u25CB",
  "&cirE;": "\u29C3",
  "&circ;": "\u02C6",
  "&circeq;": "\u2257",
  "&circlearrowleft;": "\u21BA",
  "&circlearrowright;": "\u21BB",
  "&circledR;": "\xAE",
  "&circledS;": "\u24C8",
  "&circledast;": "\u229B",
  "&circledcirc;": "\u229A",
  "&circleddash;": "\u229D",
  "&cire;": "\u2257",
  "&cirfnint;": "\u2A10",
  "&cirmid;": "\u2AEF",
  "&cirscir;": "\u29C2",
  "&clubs;": "\u2663",
  "&clubsuit;": "\u2663",
  "&colon;": ":",
  "&colone;": "\u2254",
  "&coloneq;": "\u2254",
  "&comma;": ",",
  "&commat;": "@",
  "&comp;": "\u2201",
  "&compfn;": "\u2218",
  "&complement;": "\u2201",
  "&complexes;": "\u2102",
  "&cong;": "\u2245",
  "&congdot;": "\u2A6D",
  "&conint;": "\u222E",
  "&copf;": "\u{1D554}",
  "&coprod;": "\u2210",
  "&copy": "\xA9",
  "&copy;": "\xA9",
  "&copysr;": "\u2117",
  "&crarr;": "\u21B5",
  "&cross;": "\u2717",
  "&cscr;": "\u{1D4B8}",
  "&csub;": "\u2ACF",
  "&csube;": "\u2AD1",
  "&csup;": "\u2AD0",
  "&csupe;": "\u2AD2",
  "&ctdot;": "\u22EF",
  "&cudarrl;": "\u2938",
  "&cudarrr;": "\u2935",
  "&cuepr;": "\u22DE",
  "&cuesc;": "\u22DF",
  "&cularr;": "\u21B6",
  "&cularrp;": "\u293D",
  "&cup;": "\u222A",
  "&cupbrcap;": "\u2A48",
  "&cupcap;": "\u2A46",
  "&cupcup;": "\u2A4A",
  "&cupdot;": "\u228D",
  "&cupor;": "\u2A45",
  "&cups;": "\u222A\uFE00",
  "&curarr;": "\u21B7",
  "&curarrm;": "\u293C",
  "&curlyeqprec;": "\u22DE",
  "&curlyeqsucc;": "\u22DF",
  "&curlyvee;": "\u22CE",
  "&curlywedge;": "\u22CF",
  "&curren": "\xA4",
  "&curren;": "\xA4",
  "&curvearrowleft;": "\u21B6",
  "&curvearrowright;": "\u21B7",
  "&cuvee;": "\u22CE",
  "&cuwed;": "\u22CF",
  "&cwconint;": "\u2232",
  "&cwint;": "\u2231",
  "&cylcty;": "\u232D",
  "&dArr;": "\u21D3",
  "&dHar;": "\u2965",
  "&dagger;": "\u2020",
  "&daleth;": "\u2138",
  "&darr;": "\u2193",
  "&dash;": "\u2010",
  "&dashv;": "\u22A3",
  "&dbkarow;": "\u290F",
  "&dblac;": "\u02DD",
  "&dcaron;": "\u010F",
  "&dcy;": "\u0434",
  "&dd;": "\u2146",
  "&ddagger;": "\u2021",
  "&ddarr;": "\u21CA",
  "&ddotseq;": "\u2A77",
  "&deg": "\xB0",
  "&deg;": "\xB0",
  "&delta;": "\u03B4",
  "&demptyv;": "\u29B1",
  "&dfisht;": "\u297F",
  "&dfr;": "\u{1D521}",
  "&dharl;": "\u21C3",
  "&dharr;": "\u21C2",
  "&diam;": "\u22C4",
  "&diamond;": "\u22C4",
  "&diamondsuit;": "\u2666",
  "&diams;": "\u2666",
  "&die;": "\xA8",
  "&digamma;": "\u03DD",
  "&disin;": "\u22F2",
  "&div;": "\xF7",
  "&divide": "\xF7",
  "&divide;": "\xF7",
  "&divideontimes;": "\u22C7",
  "&divonx;": "\u22C7",
  "&djcy;": "\u0452",
  "&dlcorn;": "\u231E",
  "&dlcrop;": "\u230D",
  "&dollar;": "$",
  "&dopf;": "\u{1D555}",
  "&dot;": "\u02D9",
  "&doteq;": "\u2250",
  "&doteqdot;": "\u2251",
  "&dotminus;": "\u2238",
  "&dotplus;": "\u2214",
  "&dotsquare;": "\u22A1",
  "&doublebarwedge;": "\u2306",
  "&downarrow;": "\u2193",
  "&downdownarrows;": "\u21CA",
  "&downharpoonleft;": "\u21C3",
  "&downharpoonright;": "\u21C2",
  "&drbkarow;": "\u2910",
  "&drcorn;": "\u231F",
  "&drcrop;": "\u230C",
  "&dscr;": "\u{1D4B9}",
  "&dscy;": "\u0455",
  "&dsol;": "\u29F6",
  "&dstrok;": "\u0111",
  "&dtdot;": "\u22F1",
  "&dtri;": "\u25BF",
  "&dtrif;": "\u25BE",
  "&duarr;": "\u21F5",
  "&duhar;": "\u296F",
  "&dwangle;": "\u29A6",
  "&dzcy;": "\u045F",
  "&dzigrarr;": "\u27FF",
  "&eDDot;": "\u2A77",
  "&eDot;": "\u2251",
  "&eacute": "\xE9",
  "&eacute;": "\xE9",
  "&easter;": "\u2A6E",
  "&ecaron;": "\u011B",
  "&ecir;": "\u2256",
  "&ecirc": "\xEA",
  "&ecirc;": "\xEA",
  "&ecolon;": "\u2255",
  "&ecy;": "\u044D",
  "&edot;": "\u0117",
  "&ee;": "\u2147",
  "&efDot;": "\u2252",
  "&efr;": "\u{1D522}",
  "&eg;": "\u2A9A",
  "&egrave": "\xE8",
  "&egrave;": "\xE8",
  "&egs;": "\u2A96",
  "&egsdot;": "\u2A98",
  "&el;": "\u2A99",
  "&elinters;": "\u23E7",
  "&ell;": "\u2113",
  "&els;": "\u2A95",
  "&elsdot;": "\u2A97",
  "&emacr;": "\u0113",
  "&empty;": "\u2205",
  "&emptyset;": "\u2205",
  "&emptyv;": "\u2205",
  "&emsp13;": "\u2004",
  "&emsp14;": "\u2005",
  "&emsp;": "\u2003",
  "&eng;": "\u014B",
  "&ensp;": "\u2002",
  "&eogon;": "\u0119",
  "&eopf;": "\u{1D556}",
  "&epar;": "\u22D5",
  "&eparsl;": "\u29E3",
  "&eplus;": "\u2A71",
  "&epsi;": "\u03B5",
  "&epsilon;": "\u03B5",
  "&epsiv;": "\u03F5",
  "&eqcirc;": "\u2256",
  "&eqcolon;": "\u2255",
  "&eqsim;": "\u2242",
  "&eqslantgtr;": "\u2A96",
  "&eqslantless;": "\u2A95",
  "&equals;": "=",
  "&equest;": "\u225F",
  "&equiv;": "\u2261",
  "&equivDD;": "\u2A78",
  "&eqvparsl;": "\u29E5",
  "&erDot;": "\u2253",
  "&erarr;": "\u2971",
  "&escr;": "\u212F",
  "&esdot;": "\u2250",
  "&esim;": "\u2242",
  "&eta;": "\u03B7",
  "&eth": "\xF0",
  "&eth;": "\xF0",
  "&euml": "\xEB",
  "&euml;": "\xEB",
  "&euro;": "\u20AC",
  "&excl;": "!",
  "&exist;": "\u2203",
  "&expectation;": "\u2130",
  "&exponentiale;": "\u2147",
  "&fallingdotseq;": "\u2252",
  "&fcy;": "\u0444",
  "&female;": "\u2640",
  "&ffilig;": "\uFB03",
  "&fflig;": "\uFB00",
  "&ffllig;": "\uFB04",
  "&ffr;": "\u{1D523}",
  "&filig;": "\uFB01",
  "&fjlig;": "fj",
  "&flat;": "\u266D",
  "&fllig;": "\uFB02",
  "&fltns;": "\u25B1",
  "&fnof;": "\u0192",
  "&fopf;": "\u{1D557}",
  "&forall;": "\u2200",
  "&fork;": "\u22D4",
  "&forkv;": "\u2AD9",
  "&fpartint;": "\u2A0D",
  "&frac12": "\xBD",
  "&frac12;": "\xBD",
  "&frac13;": "\u2153",
  "&frac14": "\xBC",
  "&frac14;": "\xBC",
  "&frac15;": "\u2155",
  "&frac16;": "\u2159",
  "&frac18;": "\u215B",
  "&frac23;": "\u2154",
  "&frac25;": "\u2156",
  "&frac34": "\xBE",
  "&frac34;": "\xBE",
  "&frac35;": "\u2157",
  "&frac38;": "\u215C",
  "&frac45;": "\u2158",
  "&frac56;": "\u215A",
  "&frac58;": "\u215D",
  "&frac78;": "\u215E",
  "&frasl;": "\u2044",
  "&frown;": "\u2322",
  "&fscr;": "\u{1D4BB}",
  "&gE;": "\u2267",
  "&gEl;": "\u2A8C",
  "&gacute;": "\u01F5",
  "&gamma;": "\u03B3",
  "&gammad;": "\u03DD",
  "&gap;": "\u2A86",
  "&gbreve;": "\u011F",
  "&gcirc;": "\u011D",
  "&gcy;": "\u0433",
  "&gdot;": "\u0121",
  "&ge;": "\u2265",
  "&gel;": "\u22DB",
  "&geq;": "\u2265",
  "&geqq;": "\u2267",
  "&geqslant;": "\u2A7E",
  "&ges;": "\u2A7E",
  "&gescc;": "\u2AA9",
  "&gesdot;": "\u2A80",
  "&gesdoto;": "\u2A82",
  "&gesdotol;": "\u2A84",
  "&gesl;": "\u22DB\uFE00",
  "&gesles;": "\u2A94",
  "&gfr;": "\u{1D524}",
  "&gg;": "\u226B",
  "&ggg;": "\u22D9",
  "&gimel;": "\u2137",
  "&gjcy;": "\u0453",
  "&gl;": "\u2277",
  "&glE;": "\u2A92",
  "&gla;": "\u2AA5",
  "&glj;": "\u2AA4",
  "&gnE;": "\u2269",
  "&gnap;": "\u2A8A",
  "&gnapprox;": "\u2A8A",
  "&gne;": "\u2A88",
  "&gneq;": "\u2A88",
  "&gneqq;": "\u2269",
  "&gnsim;": "\u22E7",
  "&gopf;": "\u{1D558}",
  "&grave;": "`",
  "&gscr;": "\u210A",
  "&gsim;": "\u2273",
  "&gsime;": "\u2A8E",
  "&gsiml;": "\u2A90",
  "&gt": ">",
  "&gt;": ">",
  "&gtcc;": "\u2AA7",
  "&gtcir;": "\u2A7A",
  "&gtdot;": "\u22D7",
  "&gtlPar;": "\u2995",
  "&gtquest;": "\u2A7C",
  "&gtrapprox;": "\u2A86",
  "&gtrarr;": "\u2978",
  "&gtrdot;": "\u22D7",
  "&gtreqless;": "\u22DB",
  "&gtreqqless;": "\u2A8C",
  "&gtrless;": "\u2277",
  "&gtrsim;": "\u2273",
  "&gvertneqq;": "\u2269\uFE00",
  "&gvnE;": "\u2269\uFE00",
  "&hArr;": "\u21D4",
  "&hairsp;": "\u200A",
  "&half;": "\xBD",
  "&hamilt;": "\u210B",
  "&hardcy;": "\u044A",
  "&harr;": "\u2194",
  "&harrcir;": "\u2948",
  "&harrw;": "\u21AD",
  "&hbar;": "\u210F",
  "&hcirc;": "\u0125",
  "&hearts;": "\u2665",
  "&heartsuit;": "\u2665",
  "&hellip;": "\u2026",
  "&hercon;": "\u22B9",
  "&hfr;": "\u{1D525}",
  "&hksearow;": "\u2925",
  "&hkswarow;": "\u2926",
  "&hoarr;": "\u21FF",
  "&homtht;": "\u223B",
  "&hookleftarrow;": "\u21A9",
  "&hookrightarrow;": "\u21AA",
  "&hopf;": "\u{1D559}",
  "&horbar;": "\u2015",
  "&hscr;": "\u{1D4BD}",
  "&hslash;": "\u210F",
  "&hstrok;": "\u0127",
  "&hybull;": "\u2043",
  "&hyphen;": "\u2010",
  "&iacute": "\xED",
  "&iacute;": "\xED",
  "&ic;": "\u2063",
  "&icirc": "\xEE",
  "&icirc;": "\xEE",
  "&icy;": "\u0438",
  "&iecy;": "\u0435",
  "&iexcl": "\xA1",
  "&iexcl;": "\xA1",
  "&iff;": "\u21D4",
  "&ifr;": "\u{1D526}",
  "&igrave": "\xEC",
  "&igrave;": "\xEC",
  "&ii;": "\u2148",
  "&iiiint;": "\u2A0C",
  "&iiint;": "\u222D",
  "&iinfin;": "\u29DC",
  "&iiota;": "\u2129",
  "&ijlig;": "\u0133",
  "&imacr;": "\u012B",
  "&image;": "\u2111",
  "&imagline;": "\u2110",
  "&imagpart;": "\u2111",
  "&imath;": "\u0131",
  "&imof;": "\u22B7",
  "&imped;": "\u01B5",
  "&in;": "\u2208",
  "&incare;": "\u2105",
  "&infin;": "\u221E",
  "&infintie;": "\u29DD",
  "&inodot;": "\u0131",
  "&int;": "\u222B",
  "&intcal;": "\u22BA",
  "&integers;": "\u2124",
  "&intercal;": "\u22BA",
  "&intlarhk;": "\u2A17",
  "&intprod;": "\u2A3C",
  "&iocy;": "\u0451",
  "&iogon;": "\u012F",
  "&iopf;": "\u{1D55A}",
  "&iota;": "\u03B9",
  "&iprod;": "\u2A3C",
  "&iquest": "\xBF",
  "&iquest;": "\xBF",
  "&iscr;": "\u{1D4BE}",
  "&isin;": "\u2208",
  "&isinE;": "\u22F9",
  "&isindot;": "\u22F5",
  "&isins;": "\u22F4",
  "&isinsv;": "\u22F3",
  "&isinv;": "\u2208",
  "&it;": "\u2062",
  "&itilde;": "\u0129",
  "&iukcy;": "\u0456",
  "&iuml": "\xEF",
  "&iuml;": "\xEF",
  "&jcirc;": "\u0135",
  "&jcy;": "\u0439",
  "&jfr;": "\u{1D527}",
  "&jmath;": "\u0237",
  "&jopf;": "\u{1D55B}",
  "&jscr;": "\u{1D4BF}",
  "&jsercy;": "\u0458",
  "&jukcy;": "\u0454",
  "&kappa;": "\u03BA",
  "&kappav;": "\u03F0",
  "&kcedil;": "\u0137",
  "&kcy;": "\u043A",
  "&kfr;": "\u{1D528}",
  "&kgreen;": "\u0138",
  "&khcy;": "\u0445",
  "&kjcy;": "\u045C",
  "&kopf;": "\u{1D55C}",
  "&kscr;": "\u{1D4C0}",
  "&lAarr;": "\u21DA",
  "&lArr;": "\u21D0",
  "&lAtail;": "\u291B",
  "&lBarr;": "\u290E",
  "&lE;": "\u2266",
  "&lEg;": "\u2A8B",
  "&lHar;": "\u2962",
  "&lacute;": "\u013A",
  "&laemptyv;": "\u29B4",
  "&lagran;": "\u2112",
  "&lambda;": "\u03BB",
  "&lang;": "\u27E8",
  "&langd;": "\u2991",
  "&langle;": "\u27E8",
  "&lap;": "\u2A85",
  "&laquo": "\xAB",
  "&laquo;": "\xAB",
  "&larr;": "\u2190",
  "&larrb;": "\u21E4",
  "&larrbfs;": "\u291F",
  "&larrfs;": "\u291D",
  "&larrhk;": "\u21A9",
  "&larrlp;": "\u21AB",
  "&larrpl;": "\u2939",
  "&larrsim;": "\u2973",
  "&larrtl;": "\u21A2",
  "&lat;": "\u2AAB",
  "&latail;": "\u2919",
  "&late;": "\u2AAD",
  "&lates;": "\u2AAD\uFE00",
  "&lbarr;": "\u290C",
  "&lbbrk;": "\u2772",
  "&lbrace;": "{",
  "&lbrack;": "[",
  "&lbrke;": "\u298B",
  "&lbrksld;": "\u298F",
  "&lbrkslu;": "\u298D",
  "&lcaron;": "\u013E",
  "&lcedil;": "\u013C",
  "&lceil;": "\u2308",
  "&lcub;": "{",
  "&lcy;": "\u043B",
  "&ldca;": "\u2936",
  "&ldquo;": "\u201C",
  "&ldquor;": "\u201E",
  "&ldrdhar;": "\u2967",
  "&ldrushar;": "\u294B",
  "&ldsh;": "\u21B2",
  "&le;": "\u2264",
  "&leftarrow;": "\u2190",
  "&leftarrowtail;": "\u21A2",
  "&leftharpoondown;": "\u21BD",
  "&leftharpoonup;": "\u21BC",
  "&leftleftarrows;": "\u21C7",
  "&leftrightarrow;": "\u2194",
  "&leftrightarrows;": "\u21C6",
  "&leftrightharpoons;": "\u21CB",
  "&leftrightsquigarrow;": "\u21AD",
  "&leftthreetimes;": "\u22CB",
  "&leg;": "\u22DA",
  "&leq;": "\u2264",
  "&leqq;": "\u2266",
  "&leqslant;": "\u2A7D",
  "&les;": "\u2A7D",
  "&lescc;": "\u2AA8",
  "&lesdot;": "\u2A7F",
  "&lesdoto;": "\u2A81",
  "&lesdotor;": "\u2A83",
  "&lesg;": "\u22DA\uFE00",
  "&lesges;": "\u2A93",
  "&lessapprox;": "\u2A85",
  "&lessdot;": "\u22D6",
  "&lesseqgtr;": "\u22DA",
  "&lesseqqgtr;": "\u2A8B",
  "&lessgtr;": "\u2276",
  "&lesssim;": "\u2272",
  "&lfisht;": "\u297C",
  "&lfloor;": "\u230A",
  "&lfr;": "\u{1D529}",
  "&lg;": "\u2276",
  "&lgE;": "\u2A91",
  "&lhard;": "\u21BD",
  "&lharu;": "\u21BC",
  "&lharul;": "\u296A",
  "&lhblk;": "\u2584",
  "&ljcy;": "\u0459",
  "&ll;": "\u226A",
  "&llarr;": "\u21C7",
  "&llcorner;": "\u231E",
  "&llhard;": "\u296B",
  "&lltri;": "\u25FA",
  "&lmidot;": "\u0140",
  "&lmoust;": "\u23B0",
  "&lmoustache;": "\u23B0",
  "&lnE;": "\u2268",
  "&lnap;": "\u2A89",
  "&lnapprox;": "\u2A89",
  "&lne;": "\u2A87",
  "&lneq;": "\u2A87",
  "&lneqq;": "\u2268",
  "&lnsim;": "\u22E6",
  "&loang;": "\u27EC",
  "&loarr;": "\u21FD",
  "&lobrk;": "\u27E6",
  "&longleftarrow;": "\u27F5",
  "&longleftrightarrow;": "\u27F7",
  "&longmapsto;": "\u27FC",
  "&longrightarrow;": "\u27F6",
  "&looparrowleft;": "\u21AB",
  "&looparrowright;": "\u21AC",
  "&lopar;": "\u2985",
  "&lopf;": "\u{1D55D}",
  "&loplus;": "\u2A2D",
  "&lotimes;": "\u2A34",
  "&lowast;": "\u2217",
  "&lowbar;": "_",
  "&loz;": "\u25CA",
  "&lozenge;": "\u25CA",
  "&lozf;": "\u29EB",
  "&lpar;": "(",
  "&lparlt;": "\u2993",
  "&lrarr;": "\u21C6",
  "&lrcorner;": "\u231F",
  "&lrhar;": "\u21CB",
  "&lrhard;": "\u296D",
  "&lrm;": "\u200E",
  "&lrtri;": "\u22BF",
  "&lsaquo;": "\u2039",
  "&lscr;": "\u{1D4C1}",
  "&lsh;": "\u21B0",
  "&lsim;": "\u2272",
  "&lsime;": "\u2A8D",
  "&lsimg;": "\u2A8F",
  "&lsqb;": "[",
  "&lsquo;": "\u2018",
  "&lsquor;": "\u201A",
  "&lstrok;": "\u0142",
  "&lt": "<",
  "&lt;": "<",
  "&ltcc;": "\u2AA6",
  "&ltcir;": "\u2A79",
  "&ltdot;": "\u22D6",
  "&lthree;": "\u22CB",
  "&ltimes;": "\u22C9",
  "&ltlarr;": "\u2976",
  "&ltquest;": "\u2A7B",
  "&ltrPar;": "\u2996",
  "&ltri;": "\u25C3",
  "&ltrie;": "\u22B4",
  "&ltrif;": "\u25C2",
  "&lurdshar;": "\u294A",
  "&luruhar;": "\u2966",
  "&lvertneqq;": "\u2268\uFE00",
  "&lvnE;": "\u2268\uFE00",
  "&mDDot;": "\u223A",
  "&macr": "\xAF",
  "&macr;": "\xAF",
  "&male;": "\u2642",
  "&malt;": "\u2720",
  "&maltese;": "\u2720",
  "&map;": "\u21A6",
  "&mapsto;": "\u21A6",
  "&mapstodown;": "\u21A7",
  "&mapstoleft;": "\u21A4",
  "&mapstoup;": "\u21A5",
  "&marker;": "\u25AE",
  "&mcomma;": "\u2A29",
  "&mcy;": "\u043C",
  "&mdash;": "\u2014",
  "&measuredangle;": "\u2221",
  "&mfr;": "\u{1D52A}",
  "&mho;": "\u2127",
  "&micro": "\xB5",
  "&micro;": "\xB5",
  "&mid;": "\u2223",
  "&midast;": "*",
  "&midcir;": "\u2AF0",
  "&middot": "\xB7",
  "&middot;": "\xB7",
  "&minus;": "\u2212",
  "&minusb;": "\u229F",
  "&minusd;": "\u2238",
  "&minusdu;": "\u2A2A",
  "&mlcp;": "\u2ADB",
  "&mldr;": "\u2026",
  "&mnplus;": "\u2213",
  "&models;": "\u22A7",
  "&mopf;": "\u{1D55E}",
  "&mp;": "\u2213",
  "&mscr;": "\u{1D4C2}",
  "&mstpos;": "\u223E",
  "&mu;": "\u03BC",
  "&multimap;": "\u22B8",
  "&mumap;": "\u22B8",
  "&nGg;": "\u22D9\u0338",
  "&nGt;": "\u226B\u20D2",
  "&nGtv;": "\u226B\u0338",
  "&nLeftarrow;": "\u21CD",
  "&nLeftrightarrow;": "\u21CE",
  "&nLl;": "\u22D8\u0338",
  "&nLt;": "\u226A\u20D2",
  "&nLtv;": "\u226A\u0338",
  "&nRightarrow;": "\u21CF",
  "&nVDash;": "\u22AF",
  "&nVdash;": "\u22AE",
  "&nabla;": "\u2207",
  "&nacute;": "\u0144",
  "&nang;": "\u2220\u20D2",
  "&nap;": "\u2249",
  "&napE;": "\u2A70\u0338",
  "&napid;": "\u224B\u0338",
  "&napos;": "\u0149",
  "&napprox;": "\u2249",
  "&natur;": "\u266E",
  "&natural;": "\u266E",
  "&naturals;": "\u2115",
  "&nbsp": "\xA0",
  "&nbsp;": "\xA0",
  "&nbump;": "\u224E\u0338",
  "&nbumpe;": "\u224F\u0338",
  "&ncap;": "\u2A43",
  "&ncaron;": "\u0148",
  "&ncedil;": "\u0146",
  "&ncong;": "\u2247",
  "&ncongdot;": "\u2A6D\u0338",
  "&ncup;": "\u2A42",
  "&ncy;": "\u043D",
  "&ndash;": "\u2013",
  "&ne;": "\u2260",
  "&neArr;": "\u21D7",
  "&nearhk;": "\u2924",
  "&nearr;": "\u2197",
  "&nearrow;": "\u2197",
  "&nedot;": "\u2250\u0338",
  "&nequiv;": "\u2262",
  "&nesear;": "\u2928",
  "&nesim;": "\u2242\u0338",
  "&nexist;": "\u2204",
  "&nexists;": "\u2204",
  "&nfr;": "\u{1D52B}",
  "&ngE;": "\u2267\u0338",
  "&nge;": "\u2271",
  "&ngeq;": "\u2271",
  "&ngeqq;": "\u2267\u0338",
  "&ngeqslant;": "\u2A7E\u0338",
  "&nges;": "\u2A7E\u0338",
  "&ngsim;": "\u2275",
  "&ngt;": "\u226F",
  "&ngtr;": "\u226F",
  "&nhArr;": "\u21CE",
  "&nharr;": "\u21AE",
  "&nhpar;": "\u2AF2",
  "&ni;": "\u220B",
  "&nis;": "\u22FC",
  "&nisd;": "\u22FA",
  "&niv;": "\u220B",
  "&njcy;": "\u045A",
  "&nlArr;": "\u21CD",
  "&nlE;": "\u2266\u0338",
  "&nlarr;": "\u219A",
  "&nldr;": "\u2025",
  "&nle;": "\u2270",
  "&nleftarrow;": "\u219A",
  "&nleftrightarrow;": "\u21AE",
  "&nleq;": "\u2270",
  "&nleqq;": "\u2266\u0338",
  "&nleqslant;": "\u2A7D\u0338",
  "&nles;": "\u2A7D\u0338",
  "&nless;": "\u226E",
  "&nlsim;": "\u2274",
  "&nlt;": "\u226E",
  "&nltri;": "\u22EA",
  "&nltrie;": "\u22EC",
  "&nmid;": "\u2224",
  "&nopf;": "\u{1D55F}",
  "&not": "\xAC",
  "&not;": "\xAC",
  "&notin;": "\u2209",
  "&notinE;": "\u22F9\u0338",
  "&notindot;": "\u22F5\u0338",
  "&notinva;": "\u2209",
  "&notinvb;": "\u22F7",
  "&notinvc;": "\u22F6",
  "&notni;": "\u220C",
  "&notniva;": "\u220C",
  "&notnivb;": "\u22FE",
  "&notnivc;": "\u22FD",
  "&npar;": "\u2226",
  "&nparallel;": "\u2226",
  "&nparsl;": "\u2AFD\u20E5",
  "&npart;": "\u2202\u0338",
  "&npolint;": "\u2A14",
  "&npr;": "\u2280",
  "&nprcue;": "\u22E0",
  "&npre;": "\u2AAF\u0338",
  "&nprec;": "\u2280",
  "&npreceq;": "\u2AAF\u0338",
  "&nrArr;": "\u21CF",
  "&nrarr;": "\u219B",
  "&nrarrc;": "\u2933\u0338",
  "&nrarrw;": "\u219D\u0338",
  "&nrightarrow;": "\u219B",
  "&nrtri;": "\u22EB",
  "&nrtrie;": "\u22ED",
  "&nsc;": "\u2281",
  "&nsccue;": "\u22E1",
  "&nsce;": "\u2AB0\u0338",
  "&nscr;": "\u{1D4C3}",
  "&nshortmid;": "\u2224",
  "&nshortparallel;": "\u2226",
  "&nsim;": "\u2241",
  "&nsime;": "\u2244",
  "&nsimeq;": "\u2244",
  "&nsmid;": "\u2224",
  "&nspar;": "\u2226",
  "&nsqsube;": "\u22E2",
  "&nsqsupe;": "\u22E3",
  "&nsub;": "\u2284",
  "&nsubE;": "\u2AC5\u0338",
  "&nsube;": "\u2288",
  "&nsubset;": "\u2282\u20D2",
  "&nsubseteq;": "\u2288",
  "&nsubseteqq;": "\u2AC5\u0338",
  "&nsucc;": "\u2281",
  "&nsucceq;": "\u2AB0\u0338",
  "&nsup;": "\u2285",
  "&nsupE;": "\u2AC6\u0338",
  "&nsupe;": "\u2289",
  "&nsupset;": "\u2283\u20D2",
  "&nsupseteq;": "\u2289",
  "&nsupseteqq;": "\u2AC6\u0338",
  "&ntgl;": "\u2279",
  "&ntilde": "\xF1",
  "&ntilde;": "\xF1",
  "&ntlg;": "\u2278",
  "&ntriangleleft;": "\u22EA",
  "&ntrianglelefteq;": "\u22EC",
  "&ntriangleright;": "\u22EB",
  "&ntrianglerighteq;": "\u22ED",
  "&nu;": "\u03BD",
  "&num;": "#",
  "&numero;": "\u2116",
  "&numsp;": "\u2007",
  "&nvDash;": "\u22AD",
  "&nvHarr;": "\u2904",
  "&nvap;": "\u224D\u20D2",
  "&nvdash;": "\u22AC",
  "&nvge;": "\u2265\u20D2",
  "&nvgt;": ">\u20D2",
  "&nvinfin;": "\u29DE",
  "&nvlArr;": "\u2902",
  "&nvle;": "\u2264\u20D2",
  "&nvlt;": "<\u20D2",
  "&nvltrie;": "\u22B4\u20D2",
  "&nvrArr;": "\u2903",
  "&nvrtrie;": "\u22B5\u20D2",
  "&nvsim;": "\u223C\u20D2",
  "&nwArr;": "\u21D6",
  "&nwarhk;": "\u2923",
  "&nwarr;": "\u2196",
  "&nwarrow;": "\u2196",
  "&nwnear;": "\u2927",
  "&oS;": "\u24C8",
  "&oacute": "\xF3",
  "&oacute;": "\xF3",
  "&oast;": "\u229B",
  "&ocir;": "\u229A",
  "&ocirc": "\xF4",
  "&ocirc;": "\xF4",
  "&ocy;": "\u043E",
  "&odash;": "\u229D",
  "&odblac;": "\u0151",
  "&odiv;": "\u2A38",
  "&odot;": "\u2299",
  "&odsold;": "\u29BC",
  "&oelig;": "\u0153",
  "&ofcir;": "\u29BF",
  "&ofr;": "\u{1D52C}",
  "&ogon;": "\u02DB",
  "&ograve": "\xF2",
  "&ograve;": "\xF2",
  "&ogt;": "\u29C1",
  "&ohbar;": "\u29B5",
  "&ohm;": "\u03A9",
  "&oint;": "\u222E",
  "&olarr;": "\u21BA",
  "&olcir;": "\u29BE",
  "&olcross;": "\u29BB",
  "&oline;": "\u203E",
  "&olt;": "\u29C0",
  "&omacr;": "\u014D",
  "&omega;": "\u03C9",
  "&omicron;": "\u03BF",
  "&omid;": "\u29B6",
  "&ominus;": "\u2296",
  "&oopf;": "\u{1D560}",
  "&opar;": "\u29B7",
  "&operp;": "\u29B9",
  "&oplus;": "\u2295",
  "&or;": "\u2228",
  "&orarr;": "\u21BB",
  "&ord;": "\u2A5D",
  "&order;": "\u2134",
  "&orderof;": "\u2134",
  "&ordf": "\xAA",
  "&ordf;": "\xAA",
  "&ordm": "\xBA",
  "&ordm;": "\xBA",
  "&origof;": "\u22B6",
  "&oror;": "\u2A56",
  "&orslope;": "\u2A57",
  "&orv;": "\u2A5B",
  "&oscr;": "\u2134",
  "&oslash": "\xF8",
  "&oslash;": "\xF8",
  "&osol;": "\u2298",
  "&otilde": "\xF5",
  "&otilde;": "\xF5",
  "&otimes;": "\u2297",
  "&otimesas;": "\u2A36",
  "&ouml": "\xF6",
  "&ouml;": "\xF6",
  "&ovbar;": "\u233D",
  "&par;": "\u2225",
  "&para": "\xB6",
  "&para;": "\xB6",
  "&parallel;": "\u2225",
  "&parsim;": "\u2AF3",
  "&parsl;": "\u2AFD",
  "&part;": "\u2202",
  "&pcy;": "\u043F",
  "&percnt;": "%",
  "&period;": ".",
  "&permil;": "\u2030",
  "&perp;": "\u22A5",
  "&pertenk;": "\u2031",
  "&pfr;": "\u{1D52D}",
  "&phi;": "\u03C6",
  "&phiv;": "\u03D5",
  "&phmmat;": "\u2133",
  "&phone;": "\u260E",
  "&pi;": "\u03C0",
  "&pitchfork;": "\u22D4",
  "&piv;": "\u03D6",
  "&planck;": "\u210F",
  "&planckh;": "\u210E",
  "&plankv;": "\u210F",
  "&plus;": "+",
  "&plusacir;": "\u2A23",
  "&plusb;": "\u229E",
  "&pluscir;": "\u2A22",
  "&plusdo;": "\u2214",
  "&plusdu;": "\u2A25",
  "&pluse;": "\u2A72",
  "&plusmn": "\xB1",
  "&plusmn;": "\xB1",
  "&plussim;": "\u2A26",
  "&plustwo;": "\u2A27",
  "&pm;": "\xB1",
  "&pointint;": "\u2A15",
  "&popf;": "\u{1D561}",
  "&pound": "\xA3",
  "&pound;": "\xA3",
  "&pr;": "\u227A",
  "&prE;": "\u2AB3",
  "&prap;": "\u2AB7",
  "&prcue;": "\u227C",
  "&pre;": "\u2AAF",
  "&prec;": "\u227A",
  "&precapprox;": "\u2AB7",
  "&preccurlyeq;": "\u227C",
  "&preceq;": "\u2AAF",
  "&precnapprox;": "\u2AB9",
  "&precneqq;": "\u2AB5",
  "&precnsim;": "\u22E8",
  "&precsim;": "\u227E",
  "&prime;": "\u2032",
  "&primes;": "\u2119",
  "&prnE;": "\u2AB5",
  "&prnap;": "\u2AB9",
  "&prnsim;": "\u22E8",
  "&prod;": "\u220F",
  "&profalar;": "\u232E",
  "&profline;": "\u2312",
  "&profsurf;": "\u2313",
  "&prop;": "\u221D",
  "&propto;": "\u221D",
  "&prsim;": "\u227E",
  "&prurel;": "\u22B0",
  "&pscr;": "\u{1D4C5}",
  "&psi;": "\u03C8",
  "&puncsp;": "\u2008",
  "&qfr;": "\u{1D52E}",
  "&qint;": "\u2A0C",
  "&qopf;": "\u{1D562}",
  "&qprime;": "\u2057",
  "&qscr;": "\u{1D4C6}",
  "&quaternions;": "\u210D",
  "&quatint;": "\u2A16",
  "&quest;": "?",
  "&questeq;": "\u225F",
  "&quot": '"',
  "&quot;": '"',
  "&rAarr;": "\u21DB",
  "&rArr;": "\u21D2",
  "&rAtail;": "\u291C",
  "&rBarr;": "\u290F",
  "&rHar;": "\u2964",
  "&race;": "\u223D\u0331",
  "&racute;": "\u0155",
  "&radic;": "\u221A",
  "&raemptyv;": "\u29B3",
  "&rang;": "\u27E9",
  "&rangd;": "\u2992",
  "&range;": "\u29A5",
  "&rangle;": "\u27E9",
  "&raquo": "\xBB",
  "&raquo;": "\xBB",
  "&rarr;": "\u2192",
  "&rarrap;": "\u2975",
  "&rarrb;": "\u21E5",
  "&rarrbfs;": "\u2920",
  "&rarrc;": "\u2933",
  "&rarrfs;": "\u291E",
  "&rarrhk;": "\u21AA",
  "&rarrlp;": "\u21AC",
  "&rarrpl;": "\u2945",
  "&rarrsim;": "\u2974",
  "&rarrtl;": "\u21A3",
  "&rarrw;": "\u219D",
  "&ratail;": "\u291A",
  "&ratio;": "\u2236",
  "&rationals;": "\u211A",
  "&rbarr;": "\u290D",
  "&rbbrk;": "\u2773",
  "&rbrace;": "}",
  "&rbrack;": "]",
  "&rbrke;": "\u298C",
  "&rbrksld;": "\u298E",
  "&rbrkslu;": "\u2990",
  "&rcaron;": "\u0159",
  "&rcedil;": "\u0157",
  "&rceil;": "\u2309",
  "&rcub;": "}",
  "&rcy;": "\u0440",
  "&rdca;": "\u2937",
  "&rdldhar;": "\u2969",
  "&rdquo;": "\u201D",
  "&rdquor;": "\u201D",
  "&rdsh;": "\u21B3",
  "&real;": "\u211C",
  "&realine;": "\u211B",
  "&realpart;": "\u211C",
  "&reals;": "\u211D",
  "&rect;": "\u25AD",
  "&reg": "\xAE",
  "&reg;": "\xAE",
  "&rfisht;": "\u297D",
  "&rfloor;": "\u230B",
  "&rfr;": "\u{1D52F}",
  "&rhard;": "\u21C1",
  "&rharu;": "\u21C0",
  "&rharul;": "\u296C",
  "&rho;": "\u03C1",
  "&rhov;": "\u03F1",
  "&rightarrow;": "\u2192",
  "&rightarrowtail;": "\u21A3",
  "&rightharpoondown;": "\u21C1",
  "&rightharpoonup;": "\u21C0",
  "&rightleftarrows;": "\u21C4",
  "&rightleftharpoons;": "\u21CC",
  "&rightrightarrows;": "\u21C9",
  "&rightsquigarrow;": "\u219D",
  "&rightthreetimes;": "\u22CC",
  "&ring;": "\u02DA",
  "&risingdotseq;": "\u2253",
  "&rlarr;": "\u21C4",
  "&rlhar;": "\u21CC",
  "&rlm;": "\u200F",
  "&rmoust;": "\u23B1",
  "&rmoustache;": "\u23B1",
  "&rnmid;": "\u2AEE",
  "&roang;": "\u27ED",
  "&roarr;": "\u21FE",
  "&robrk;": "\u27E7",
  "&ropar;": "\u2986",
  "&ropf;": "\u{1D563}",
  "&roplus;": "\u2A2E",
  "&rotimes;": "\u2A35",
  "&rpar;": ")",
  "&rpargt;": "\u2994",
  "&rppolint;": "\u2A12",
  "&rrarr;": "\u21C9",
  "&rsaquo;": "\u203A",
  "&rscr;": "\u{1D4C7}",
  "&rsh;": "\u21B1",
  "&rsqb;": "]",
  "&rsquo;": "\u2019",
  "&rsquor;": "\u2019",
  "&rthree;": "\u22CC",
  "&rtimes;": "\u22CA",
  "&rtri;": "\u25B9",
  "&rtrie;": "\u22B5",
  "&rtrif;": "\u25B8",
  "&rtriltri;": "\u29CE",
  "&ruluhar;": "\u2968",
  "&rx;": "\u211E",
  "&sacute;": "\u015B",
  "&sbquo;": "\u201A",
  "&sc;": "\u227B",
  "&scE;": "\u2AB4",
  "&scap;": "\u2AB8",
  "&scaron;": "\u0161",
  "&sccue;": "\u227D",
  "&sce;": "\u2AB0",
  "&scedil;": "\u015F",
  "&scirc;": "\u015D",
  "&scnE;": "\u2AB6",
  "&scnap;": "\u2ABA",
  "&scnsim;": "\u22E9",
  "&scpolint;": "\u2A13",
  "&scsim;": "\u227F",
  "&scy;": "\u0441",
  "&sdot;": "\u22C5",
  "&sdotb;": "\u22A1",
  "&sdote;": "\u2A66",
  "&seArr;": "\u21D8",
  "&searhk;": "\u2925",
  "&searr;": "\u2198",
  "&searrow;": "\u2198",
  "&sect": "\xA7",
  "&sect;": "\xA7",
  "&semi;": ";",
  "&seswar;": "\u2929",
  "&setminus;": "\u2216",
  "&setmn;": "\u2216",
  "&sext;": "\u2736",
  "&sfr;": "\u{1D530}",
  "&sfrown;": "\u2322",
  "&sharp;": "\u266F",
  "&shchcy;": "\u0449",
  "&shcy;": "\u0448",
  "&shortmid;": "\u2223",
  "&shortparallel;": "\u2225",
  "&shy": "\xAD",
  "&shy;": "\xAD",
  "&sigma;": "\u03C3",
  "&sigmaf;": "\u03C2",
  "&sigmav;": "\u03C2",
  "&sim;": "\u223C",
  "&simdot;": "\u2A6A",
  "&sime;": "\u2243",
  "&simeq;": "\u2243",
  "&simg;": "\u2A9E",
  "&simgE;": "\u2AA0",
  "&siml;": "\u2A9D",
  "&simlE;": "\u2A9F",
  "&simne;": "\u2246",
  "&simplus;": "\u2A24",
  "&simrarr;": "\u2972",
  "&slarr;": "\u2190",
  "&smallsetminus;": "\u2216",
  "&smashp;": "\u2A33",
  "&smeparsl;": "\u29E4",
  "&smid;": "\u2223",
  "&smile;": "\u2323",
  "&smt;": "\u2AAA",
  "&smte;": "\u2AAC",
  "&smtes;": "\u2AAC\uFE00",
  "&softcy;": "\u044C",
  "&sol;": "/",
  "&solb;": "\u29C4",
  "&solbar;": "\u233F",
  "&sopf;": "\u{1D564}",
  "&spades;": "\u2660",
  "&spadesuit;": "\u2660",
  "&spar;": "\u2225",
  "&sqcap;": "\u2293",
  "&sqcaps;": "\u2293\uFE00",
  "&sqcup;": "\u2294",
  "&sqcups;": "\u2294\uFE00",
  "&sqsub;": "\u228F",
  "&sqsube;": "\u2291",
  "&sqsubset;": "\u228F",
  "&sqsubseteq;": "\u2291",
  "&sqsup;": "\u2290",
  "&sqsupe;": "\u2292",
  "&sqsupset;": "\u2290",
  "&sqsupseteq;": "\u2292",
  "&squ;": "\u25A1",
  "&square;": "\u25A1",
  "&squarf;": "\u25AA",
  "&squf;": "\u25AA",
  "&srarr;": "\u2192",
  "&sscr;": "\u{1D4C8}",
  "&ssetmn;": "\u2216",
  "&ssmile;": "\u2323",
  "&sstarf;": "\u22C6",
  "&star;": "\u2606",
  "&starf;": "\u2605",
  "&straightepsilon;": "\u03F5",
  "&straightphi;": "\u03D5",
  "&strns;": "\xAF",
  "&sub;": "\u2282",
  "&subE;": "\u2AC5",
  "&subdot;": "\u2ABD",
  "&sube;": "\u2286",
  "&subedot;": "\u2AC3",
  "&submult;": "\u2AC1",
  "&subnE;": "\u2ACB",
  "&subne;": "\u228A",
  "&subplus;": "\u2ABF",
  "&subrarr;": "\u2979",
  "&subset;": "\u2282",
  "&subseteq;": "\u2286",
  "&subseteqq;": "\u2AC5",
  "&subsetneq;": "\u228A",
  "&subsetneqq;": "\u2ACB",
  "&subsim;": "\u2AC7",
  "&subsub;": "\u2AD5",
  "&subsup;": "\u2AD3",
  "&succ;": "\u227B",
  "&succapprox;": "\u2AB8",
  "&succcurlyeq;": "\u227D",
  "&succeq;": "\u2AB0",
  "&succnapprox;": "\u2ABA",
  "&succneqq;": "\u2AB6",
  "&succnsim;": "\u22E9",
  "&succsim;": "\u227F",
  "&sum;": "\u2211",
  "&sung;": "\u266A",
  "&sup1": "\xB9",
  "&sup1;": "\xB9",
  "&sup2": "\xB2",
  "&sup2;": "\xB2",
  "&sup3": "\xB3",
  "&sup3;": "\xB3",
  "&sup;": "\u2283",
  "&supE;": "\u2AC6",
  "&supdot;": "\u2ABE",
  "&supdsub;": "\u2AD8",
  "&supe;": "\u2287",
  "&supedot;": "\u2AC4",
  "&suphsol;": "\u27C9",
  "&suphsub;": "\u2AD7",
  "&suplarr;": "\u297B",
  "&supmult;": "\u2AC2",
  "&supnE;": "\u2ACC",
  "&supne;": "\u228B",
  "&supplus;": "\u2AC0",
  "&supset;": "\u2283",
  "&supseteq;": "\u2287",
  "&supseteqq;": "\u2AC6",
  "&supsetneq;": "\u228B",
  "&supsetneqq;": "\u2ACC",
  "&supsim;": "\u2AC8",
  "&supsub;": "\u2AD4",
  "&supsup;": "\u2AD6",
  "&swArr;": "\u21D9",
  "&swarhk;": "\u2926",
  "&swarr;": "\u2199",
  "&swarrow;": "\u2199",
  "&swnwar;": "\u292A",
  "&szlig": "\xDF",
  "&szlig;": "\xDF",
  "&target;": "\u2316",
  "&tau;": "\u03C4",
  "&tbrk;": "\u23B4",
  "&tcaron;": "\u0165",
  "&tcedil;": "\u0163",
  "&tcy;": "\u0442",
  "&tdot;": "\u20DB",
  "&telrec;": "\u2315",
  "&tfr;": "\u{1D531}",
  "&there4;": "\u2234",
  "&therefore;": "\u2234",
  "&theta;": "\u03B8",
  "&thetasym;": "\u03D1",
  "&thetav;": "\u03D1",
  "&thickapprox;": "\u2248",
  "&thicksim;": "\u223C",
  "&thinsp;": "\u2009",
  "&thkap;": "\u2248",
  "&thksim;": "\u223C",
  "&thorn": "\xFE",
  "&thorn;": "\xFE",
  "&tilde;": "\u02DC",
  "&times": "\xD7",
  "&times;": "\xD7",
  "&timesb;": "\u22A0",
  "&timesbar;": "\u2A31",
  "&timesd;": "\u2A30",
  "&tint;": "\u222D",
  "&toea;": "\u2928",
  "&top;": "\u22A4",
  "&topbot;": "\u2336",
  "&topcir;": "\u2AF1",
  "&topf;": "\u{1D565}",
  "&topfork;": "\u2ADA",
  "&tosa;": "\u2929",
  "&tprime;": "\u2034",
  "&trade;": "\u2122",
  "&triangle;": "\u25B5",
  "&triangledown;": "\u25BF",
  "&triangleleft;": "\u25C3",
  "&trianglelefteq;": "\u22B4",
  "&triangleq;": "\u225C",
  "&triangleright;": "\u25B9",
  "&trianglerighteq;": "\u22B5",
  "&tridot;": "\u25EC",
  "&trie;": "\u225C",
  "&triminus;": "\u2A3A",
  "&triplus;": "\u2A39",
  "&trisb;": "\u29CD",
  "&tritime;": "\u2A3B",
  "&trpezium;": "\u23E2",
  "&tscr;": "\u{1D4C9}",
  "&tscy;": "\u0446",
  "&tshcy;": "\u045B",
  "&tstrok;": "\u0167",
  "&twixt;": "\u226C",
  "&twoheadleftarrow;": "\u219E",
  "&twoheadrightarrow;": "\u21A0",
  "&uArr;": "\u21D1",
  "&uHar;": "\u2963",
  "&uacute": "\xFA",
  "&uacute;": "\xFA",
  "&uarr;": "\u2191",
  "&ubrcy;": "\u045E",
  "&ubreve;": "\u016D",
  "&ucirc": "\xFB",
  "&ucirc;": "\xFB",
  "&ucy;": "\u0443",
  "&udarr;": "\u21C5",
  "&udblac;": "\u0171",
  "&udhar;": "\u296E",
  "&ufisht;": "\u297E",
  "&ufr;": "\u{1D532}",
  "&ugrave": "\xF9",
  "&ugrave;": "\xF9",
  "&uharl;": "\u21BF",
  "&uharr;": "\u21BE",
  "&uhblk;": "\u2580",
  "&ulcorn;": "\u231C",
  "&ulcorner;": "\u231C",
  "&ulcrop;": "\u230F",
  "&ultri;": "\u25F8",
  "&umacr;": "\u016B",
  "&uml": "\xA8",
  "&uml;": "\xA8",
  "&uogon;": "\u0173",
  "&uopf;": "\u{1D566}",
  "&uparrow;": "\u2191",
  "&updownarrow;": "\u2195",
  "&upharpoonleft;": "\u21BF",
  "&upharpoonright;": "\u21BE",
  "&uplus;": "\u228E",
  "&upsi;": "\u03C5",
  "&upsih;": "\u03D2",
  "&upsilon;": "\u03C5",
  "&upuparrows;": "\u21C8",
  "&urcorn;": "\u231D",
  "&urcorner;": "\u231D",
  "&urcrop;": "\u230E",
  "&uring;": "\u016F",
  "&urtri;": "\u25F9",
  "&uscr;": "\u{1D4CA}",
  "&utdot;": "\u22F0",
  "&utilde;": "\u0169",
  "&utri;": "\u25B5",
  "&utrif;": "\u25B4",
  "&uuarr;": "\u21C8",
  "&uuml": "\xFC",
  "&uuml;": "\xFC",
  "&uwangle;": "\u29A7",
  "&vArr;": "\u21D5",
  "&vBar;": "\u2AE8",
  "&vBarv;": "\u2AE9",
  "&vDash;": "\u22A8",
  "&vangrt;": "\u299C",
  "&varepsilon;": "\u03F5",
  "&varkappa;": "\u03F0",
  "&varnothing;": "\u2205",
  "&varphi;": "\u03D5",
  "&varpi;": "\u03D6",
  "&varpropto;": "\u221D",
  "&varr;": "\u2195",
  "&varrho;": "\u03F1",
  "&varsigma;": "\u03C2",
  "&varsubsetneq;": "\u228A\uFE00",
  "&varsubsetneqq;": "\u2ACB\uFE00",
  "&varsupsetneq;": "\u228B\uFE00",
  "&varsupsetneqq;": "\u2ACC\uFE00",
  "&vartheta;": "\u03D1",
  "&vartriangleleft;": "\u22B2",
  "&vartriangleright;": "\u22B3",
  "&vcy;": "\u0432",
  "&vdash;": "\u22A2",
  "&vee;": "\u2228",
  "&veebar;": "\u22BB",
  "&veeeq;": "\u225A",
  "&vellip;": "\u22EE",
  "&verbar;": "|",
  "&vert;": "|",
  "&vfr;": "\u{1D533}",
  "&vltri;": "\u22B2",
  "&vnsub;": "\u2282\u20D2",
  "&vnsup;": "\u2283\u20D2",
  "&vopf;": "\u{1D567}",
  "&vprop;": "\u221D",
  "&vrtri;": "\u22B3",
  "&vscr;": "\u{1D4CB}",
  "&vsubnE;": "\u2ACB\uFE00",
  "&vsubne;": "\u228A\uFE00",
  "&vsupnE;": "\u2ACC\uFE00",
  "&vsupne;": "\u228B\uFE00",
  "&vzigzag;": "\u299A",
  "&wcirc;": "\u0175",
  "&wedbar;": "\u2A5F",
  "&wedge;": "\u2227",
  "&wedgeq;": "\u2259",
  "&weierp;": "\u2118",
  "&wfr;": "\u{1D534}",
  "&wopf;": "\u{1D568}",
  "&wp;": "\u2118",
  "&wr;": "\u2240",
  "&wreath;": "\u2240",
  "&wscr;": "\u{1D4CC}",
  "&xcap;": "\u22C2",
  "&xcirc;": "\u25EF",
  "&xcup;": "\u22C3",
  "&xdtri;": "\u25BD",
  "&xfr;": "\u{1D535}",
  "&xhArr;": "\u27FA",
  "&xharr;": "\u27F7",
  "&xi;": "\u03BE",
  "&xlArr;": "\u27F8",
  "&xlarr;": "\u27F5",
  "&xmap;": "\u27FC",
  "&xnis;": "\u22FB",
  "&xodot;": "\u2A00",
  "&xopf;": "\u{1D569}",
  "&xoplus;": "\u2A01",
  "&xotime;": "\u2A02",
  "&xrArr;": "\u27F9",
  "&xrarr;": "\u27F6",
  "&xscr;": "\u{1D4CD}",
  "&xsqcup;": "\u2A06",
  "&xuplus;": "\u2A04",
  "&xutri;": "\u25B3",
  "&xvee;": "\u22C1",
  "&xwedge;": "\u22C0",
  "&yacute": "\xFD",
  "&yacute;": "\xFD",
  "&yacy;": "\u044F",
  "&ycirc;": "\u0177",
  "&ycy;": "\u044B",
  "&yen": "\xA5",
  "&yen;": "\xA5",
  "&yfr;": "\u{1D536}",
  "&yicy;": "\u0457",
  "&yopf;": "\u{1D56A}",
  "&yscr;": "\u{1D4CE}",
  "&yucy;": "\u044E",
  "&yuml": "\xFF",
  "&yuml;": "\xFF",
  "&zacute;": "\u017A",
  "&zcaron;": "\u017E",
  "&zcy;": "\u0437",
  "&zdot;": "\u017C",
  "&zeetrf;": "\u2128",
  "&zeta;": "\u03B6",
  "&zfr;": "\u{1D537}",
  "&zhcy;": "\u0436",
  "&zigrarr;": "\u21DD",
  "&zopf;": "\u{1D56B}",
  "&zscr;": "\u{1D4CF}",
  "&zwj;": "\u200D",
  "&zwnj;": "\u200C"
};
var html_entities_default = htmlEntities;

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/text-format.js
function decodeHTMLEntities(str) {
  return str.replace(/&(#\d+|#x[a-f0-9]+|[a-z]+\d*);?/gi, (match2, entity) => {
    if (typeof html_entities_default[match2] === "string") {
      return html_entities_default[match2];
    }
    if (entity.charAt(0) !== "#" || match2.charAt(match2.length - 1) !== ";") {
      return match2;
    }
    let codePoint;
    if (entity.charAt(1) === "x") {
      codePoint = parseInt(entity.substr(2), 16);
    } else {
      codePoint = parseInt(entity.substr(1), 10);
    }
    let output = "";
    if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
      return "\uFFFD";
    }
    if (codePoint > 65535) {
      codePoint -= 65536;
      output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    output += String.fromCharCode(codePoint);
    return output;
  });
}
__name(decodeHTMLEntities, "decodeHTMLEntities");
function escapeHtml(str) {
  return str.trim().replace(/[<>"'?&]/g, (c) => {
    let hex = c.charCodeAt(0).toString(16);
    if (hex.length < 2) {
      hex = "0" + hex;
    }
    return "&#x" + hex.toUpperCase() + ";";
  });
}
__name(escapeHtml, "escapeHtml");
function textToHtml(str) {
  let html = escapeHtml(str).replace(/\n/g, "<br />");
  return "<div>" + html + "</div>";
}
__name(textToHtml, "textToHtml");
function htmlToText(str) {
  str = str.replace(/\r?\n/g, "").replace(/<\!\-\-.*?\-\->/gi, " ").replace(/<br\b[^>]*>/gi, "\n").replace(/<\/?(p|div|table|tr|td|th)\b[^>]*>/gi, "\n\n").replace(/<script\b[^>]*>.*?<\/script\b[^>]*>/gi, " ").replace(/^.*<body\b[^>]*>/i, "").replace(/^.*<\/head\b[^>]*>/i, "").replace(/^.*<\!doctype\b[^>]*>/i, "").replace(/<\/body\b[^>]*>.*$/i, "").replace(/<\/html\b[^>]*>.*$/i, "").replace(/<a\b[^>]*href\s*=\s*["']?([^\s"']+)[^>]*>/gi, " ($1) ").replace(/<\/?(span|em|i|strong|b|u|a)\b[^>]*>/gi, "").replace(/<li\b[^>]*>[\n\u0001\s]*/gi, "* ").replace(/<hr\b[^>]*>/g, "\n-------------\n").replace(/<[^>]*>/g, " ").replace(/\u0001/g, "\n").replace(/[ \t]+/g, " ").replace(/^\s+$/gm, "").replace(/\n\n+/g, "\n\n").replace(/^\n+/, "\n").replace(/\n+$/, "\n");
  str = decodeHTMLEntities(str);
  return str;
}
__name(htmlToText, "htmlToText");
function formatTextAddress(address) {
  return [].concat(address.name || []).concat(address.name ? `<${address.address}>` : address.address).join(" ");
}
__name(formatTextAddress, "formatTextAddress");
function formatTextAddresses(addresses2) {
  let parts = [];
  let processAddress = /* @__PURE__ */ __name((address, partCounter) => {
    if (partCounter) {
      parts.push(", ");
    }
    if (address.group) {
      let groupStart = `${address.name}:`;
      let groupEnd = `;`;
      parts.push(groupStart);
      address.group.forEach(processAddress);
      parts.push(groupEnd);
    } else {
      parts.push(formatTextAddress(address));
    }
  }, "processAddress");
  addresses2.forEach(processAddress);
  return parts.join("");
}
__name(formatTextAddresses, "formatTextAddresses");
function formatHtmlAddress(address) {
  return `<a href="mailto:${escapeHtml(address.address)}" class="postal-email-address">${escapeHtml(address.name || `<${address.address}>`)}</a>`;
}
__name(formatHtmlAddress, "formatHtmlAddress");
function formatHtmlAddresses(addresses2) {
  let parts = [];
  let processAddress = /* @__PURE__ */ __name((address, partCounter) => {
    if (partCounter) {
      parts.push('<span class="postal-email-address-separator">, </span>');
    }
    if (address.group) {
      let groupStart = `<span class="postal-email-address-group">${escapeHtml(address.name)}:</span>`;
      let groupEnd = `<span class="postal-email-address-group">;</span>`;
      parts.push(groupStart);
      address.group.forEach(processAddress);
      parts.push(groupEnd);
    } else {
      parts.push(formatHtmlAddress(address));
    }
  }, "processAddress");
  addresses2.forEach(processAddress);
  return parts.join(" ");
}
__name(formatHtmlAddresses, "formatHtmlAddresses");
function foldLines(str, lineLength, afterSpace) {
  str = (str || "").toString();
  lineLength = lineLength || 76;
  let pos = 0, len = str.length, result = "", line, match2;
  while (pos < len) {
    line = str.substr(pos, lineLength);
    if (line.length < lineLength) {
      result += line;
      break;
    }
    if (match2 = line.match(/^[^\n\r]*(\r?\n|\r)/)) {
      line = match2[0];
      result += line;
      pos += line.length;
      continue;
    } else if ((match2 = line.match(/(\s+)[^\s]*$/)) && match2[0].length - (afterSpace ? (match2[1] || "").length : 0) < line.length) {
      line = line.substr(0, line.length - (match2[0].length - (afterSpace ? (match2[1] || "").length : 0)));
    } else if (match2 = str.substr(pos + line.length).match(/^[^\s]+(\s*)/)) {
      line = line + match2[0].substr(0, match2[0].length - (!afterSpace ? (match2[1] || "").length : 0));
    }
    result += line;
    pos += line.length;
    if (pos < len) {
      result += "\r\n";
    }
  }
  return result;
}
__name(foldLines, "foldLines");
function formatTextHeader(message) {
  let rows = [];
  if (message.from) {
    rows.push({ key: "From", val: formatTextAddress(message.from) });
  }
  if (message.subject) {
    rows.push({ key: "Subject", val: message.subject });
  }
  if (message.date) {
    let dateOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false
    };
    let dateStr = typeof Intl === "undefined" ? message.date : new Intl.DateTimeFormat("default", dateOptions).format(new Date(message.date));
    rows.push({ key: "Date", val: dateStr });
  }
  if (message.to && message.to.length) {
    rows.push({ key: "To", val: formatTextAddresses(message.to) });
  }
  if (message.cc && message.cc.length) {
    rows.push({ key: "Cc", val: formatTextAddresses(message.cc) });
  }
  if (message.bcc && message.bcc.length) {
    rows.push({ key: "Bcc", val: formatTextAddresses(message.bcc) });
  }
  let maxKeyLength = rows.map((r) => r.key.length).reduce((acc, cur) => {
    return cur > acc ? cur : acc;
  }, 0);
  rows = rows.flatMap((row) => {
    let sepLen = maxKeyLength - row.key.length;
    let prefix = `${row.key}: ${" ".repeat(sepLen)}`;
    let emptyPrefix = `${" ".repeat(row.key.length + 1)} ${" ".repeat(sepLen)}`;
    let foldedLines = foldLines(row.val, 80, true).split(/\r?\n/).map((line) => line.trim());
    return foldedLines.map((line, i) => `${i ? emptyPrefix : prefix}${line}`);
  });
  let maxLineLength = rows.map((r) => r.length).reduce((acc, cur) => {
    return cur > acc ? cur : acc;
  }, 0);
  let lineMarker = "-".repeat(maxLineLength);
  let template = `
${lineMarker}
${rows.join("\n")}
${lineMarker}
`;
  return template;
}
__name(formatTextHeader, "formatTextHeader");
function formatHtmlHeader(message) {
  let rows = [];
  if (message.from) {
    rows.push(
      `<div class="postal-email-header-key">From</div><div class="postal-email-header-value">${formatHtmlAddress(message.from)}</div>`
    );
  }
  if (message.subject) {
    rows.push(
      `<div class="postal-email-header-key">Subject</div><div class="postal-email-header-value postal-email-header-subject">${escapeHtml(
        message.subject
      )}</div>`
    );
  }
  if (message.date) {
    let dateOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false
    };
    let dateStr = typeof Intl === "undefined" ? message.date : new Intl.DateTimeFormat("default", dateOptions).format(new Date(message.date));
    rows.push(
      `<div class="postal-email-header-key">Date</div><div class="postal-email-header-value postal-email-header-date" data-date="${escapeHtml(
        message.date
      )}">${escapeHtml(dateStr)}</div>`
    );
  }
  if (message.to && message.to.length) {
    rows.push(
      `<div class="postal-email-header-key">To</div><div class="postal-email-header-value">${formatHtmlAddresses(message.to)}</div>`
    );
  }
  if (message.cc && message.cc.length) {
    rows.push(
      `<div class="postal-email-header-key">Cc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.cc)}</div>`
    );
  }
  if (message.bcc && message.bcc.length) {
    rows.push(
      `<div class="postal-email-header-key">Bcc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.bcc)}</div>`
    );
  }
  let template = `<div class="postal-email-header">${rows.length ? '<div class="postal-email-header-row">' : ""}${rows.join(
    '</div>\n<div class="postal-email-header-row">'
  )}${rows.length ? "</div>" : ""}</div>`;
  return template;
}
__name(formatHtmlHeader, "formatHtmlHeader");

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/address-parser.js
function _handleAddress(tokens, depth) {
  let isGroup = false;
  let state = "text";
  let address;
  let addresses2 = [];
  let data = {
    address: [],
    comment: [],
    group: [],
    text: [],
    textWasQuoted: []
    // Track which text tokens came from inside quotes
  };
  let i;
  let len;
  let insideQuotes = false;
  for (i = 0, len = tokens.length; i < len; i++) {
    let token = tokens[i];
    let prevToken = i ? tokens[i - 1] : null;
    if (token.type === "operator") {
      switch (token.value) {
        case "<":
          state = "address";
          insideQuotes = false;
          break;
        case "(":
          state = "comment";
          insideQuotes = false;
          break;
        case ":":
          state = "group";
          isGroup = true;
          insideQuotes = false;
          break;
        case '"':
          insideQuotes = !insideQuotes;
          state = "text";
          break;
        default:
          state = "text";
          insideQuotes = false;
          break;
      }
    } else if (token.value) {
      if (state === "address") {
        token.value = token.value.replace(/^[^<]*<\s*/, "");
      }
      if (prevToken && prevToken.noBreak && data[state].length) {
        data[state][data[state].length - 1] += token.value;
        if (state === "text" && insideQuotes) {
          data.textWasQuoted[data.textWasQuoted.length - 1] = true;
        }
      } else {
        data[state].push(token.value);
        if (state === "text") {
          data.textWasQuoted.push(insideQuotes);
        }
      }
    }
  }
  if (!data.text.length && data.comment.length) {
    data.text = data.comment;
    data.comment = [];
  }
  if (isGroup) {
    data.text = data.text.join(" ");
    let groupMembers = [];
    if (data.group.length) {
      let parsedGroup = addressParser(data.group.join(","), { _depth: depth + 1 });
      parsedGroup.forEach((member) => {
        if (member.group) {
          groupMembers = groupMembers.concat(member.group);
        } else {
          groupMembers.push(member);
        }
      });
    }
    addresses2.push({
      name: decodeWords(data.text || address && address.name),
      group: groupMembers
    });
  } else {
    if (!data.address.length && data.text.length) {
      for (i = data.text.length - 1; i >= 0; i--) {
        if (!data.textWasQuoted[i] && data.text[i].match(/^[^@\s]+@[^@\s]+$/)) {
          data.address = data.text.splice(i, 1);
          data.textWasQuoted.splice(i, 1);
          break;
        }
      }
      let _regexHandler = /* @__PURE__ */ __name(function(address2) {
        if (!data.address.length) {
          data.address = [address2.trim()];
          return " ";
        } else {
          return address2;
        }
      }, "_regexHandler");
      if (!data.address.length) {
        for (i = data.text.length - 1; i >= 0; i--) {
          if (!data.textWasQuoted[i]) {
            data.text[i] = data.text[i].replace(/\s*\b[^@\s]+@[^\s]+\b\s*/, _regexHandler).trim();
            if (data.address.length) {
              break;
            }
          }
        }
      }
    }
    if (!data.text.length && data.comment.length) {
      data.text = data.comment;
      data.comment = [];
    }
    if (data.address.length > 1) {
      data.text = data.text.concat(data.address.splice(1));
    }
    data.text = data.text.join(" ");
    data.address = data.address.join(" ");
    if (!data.address && /^=\?[^=]+?=$/.test(data.text.trim())) {
      const decodedText = decodeWords(data.text);
      if (/<[^<>]+@[^<>]+>/.test(decodedText)) {
        const parsedSubAddresses = addressParser(decodedText);
        if (parsedSubAddresses && parsedSubAddresses.length) {
          return parsedSubAddresses;
        }
      }
      return [{ address: "", name: decodedText }];
    }
    address = {
      address: data.address || data.text || "",
      name: decodeWords(data.text || data.address || "")
    };
    if (address.address === address.name) {
      if ((address.address || "").match(/@/)) {
        address.name = "";
      } else {
        address.address = "";
      }
    }
    addresses2.push(address);
  }
  return addresses2;
}
__name(_handleAddress, "_handleAddress");
var Tokenizer = class {
  static {
    __name(this, "Tokenizer");
  }
  constructor(str) {
    this.str = (str || "").toString();
    this.operatorCurrent = "";
    this.operatorExpecting = "";
    this.node = null;
    this.escaped = false;
    this.list = [];
    this.operators = {
      '"': '"',
      "(": ")",
      "<": ">",
      ",": "",
      ":": ";",
      // Semicolons are not a legal delimiter per the RFC2822 grammar other
      // than for terminating a group, but they are also not valid for any
      // other use in this context.  Given that some mail clients have
      // historically allowed the semicolon as a delimiter equivalent to the
      // comma in their UI, it makes sense to treat them the same as a comma
      // when used outside of a group.
      ";": ""
    };
  }
  /**
   * Tokenizes the original input string
   *
   * @return {Array} An array of operator|text tokens
   */
  tokenize() {
    let list = [];
    for (let i = 0, len = this.str.length; i < len; i++) {
      let chr = this.str.charAt(i);
      let nextChr = i < len - 1 ? this.str.charAt(i + 1) : null;
      this.checkChar(chr, nextChr);
    }
    this.list.forEach((node) => {
      node.value = (node.value || "").toString().trim();
      if (node.value) {
        list.push(node);
      }
    });
    return list;
  }
  /**
   * Checks if a character is an operator or text and acts accordingly
   *
   * @param {String} chr Character from the address field
   */
  checkChar(chr, nextChr) {
    if (this.escaped) {
    } else if (chr === this.operatorExpecting) {
      this.node = {
        type: "operator",
        value: chr
      };
      if (nextChr && ![" ", "	", "\r", "\n", ",", ";"].includes(nextChr)) {
        this.node.noBreak = true;
      }
      this.list.push(this.node);
      this.node = null;
      this.operatorExpecting = "";
      this.escaped = false;
      return;
    } else if (!this.operatorExpecting && chr in this.operators) {
      this.node = {
        type: "operator",
        value: chr
      };
      this.list.push(this.node);
      this.node = null;
      this.operatorExpecting = this.operators[chr];
      this.escaped = false;
      return;
    } else if (this.operatorExpecting === '"' && chr === "\\") {
      this.escaped = true;
      return;
    }
    if (!this.node) {
      this.node = {
        type: "text",
        value: ""
      };
      this.list.push(this.node);
    }
    if (chr === "\n") {
      chr = " ";
    }
    if (chr.charCodeAt(0) >= 33 || [" ", "	"].includes(chr)) {
      this.node.value += chr;
    }
    this.escaped = false;
  }
};
var MAX_NESTED_GROUP_DEPTH = 50;
function addressParser(str, options) {
  options = options || {};
  let depth = options._depth || 0;
  if (depth > MAX_NESTED_GROUP_DEPTH) {
    return [];
  }
  let tokenizer = new Tokenizer(str);
  let tokens = tokenizer.tokenize();
  let addresses2 = [];
  let address = [];
  let parsedAddresses = [];
  tokens.forEach((token) => {
    if (token.type === "operator" && (token.value === "," || token.value === ";")) {
      if (address.length) {
        addresses2.push(address);
      }
      address = [];
    } else {
      address.push(token);
    }
  });
  if (address.length) {
    addresses2.push(address);
  }
  addresses2.forEach((address2) => {
    address2 = _handleAddress(address2, depth);
    if (address2.length) {
      parsedAddresses = parsedAddresses.concat(address2);
    }
  });
  if (options.flatten) {
    let addresses3 = [];
    let walkAddressList = /* @__PURE__ */ __name((list) => {
      list.forEach((address2) => {
        if (address2.group) {
          return walkAddressList(address2.group);
        } else {
          addresses3.push(address2);
        }
      });
    }, "walkAddressList");
    walkAddressList(parsedAddresses);
    return addresses3;
  }
  return parsedAddresses;
}
__name(addressParser, "addressParser");
var address_parser_default = addressParser;

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/base64-encoder.js
function base64ArrayBuffer(arrayBuffer) {
  var base64 = "";
  var encodings = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var bytes = new Uint8Array(arrayBuffer);
  var byteLength = bytes.byteLength;
  var byteRemainder = byteLength % 3;
  var mainLength = byteLength - byteRemainder;
  var a, b, c, d;
  var chunk;
  for (var i = 0; i < mainLength; i = i + 3) {
    chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
    a = (chunk & 16515072) >> 18;
    b = (chunk & 258048) >> 12;
    c = (chunk & 4032) >> 6;
    d = chunk & 63;
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
  }
  if (byteRemainder == 1) {
    chunk = bytes[mainLength];
    a = (chunk & 252) >> 2;
    b = (chunk & 3) << 4;
    base64 += encodings[a] + encodings[b] + "==";
  } else if (byteRemainder == 2) {
    chunk = bytes[mainLength] << 8 | bytes[mainLength + 1];
    a = (chunk & 64512) >> 10;
    b = (chunk & 1008) >> 4;
    c = (chunk & 15) << 2;
    base64 += encodings[a] + encodings[b] + encodings[c] + "=";
  }
  return base64;
}
__name(base64ArrayBuffer, "base64ArrayBuffer");

// node_modules/.pnpm/postal-mime@2.7.6/node_modules/postal-mime/src/postal-mime.js
var MAX_NESTING_DEPTH = 256;
var MAX_HEADERS_SIZE = 2 * 1024 * 1024;
var MAX_RFC822_NESTING_DEPTH = 10;
function toCamelCase2(key) {
  return key.replace(/-(.)/g, (o, c) => c.toUpperCase());
}
__name(toCamelCase2, "toCamelCase");
function parseLimitOption(value, defaultValue, name) {
  if (value === void 0 || value === null) {
    return defaultValue;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return value;
}
__name(parseLimitOption, "parseLimitOption");
var PostalMime = class _PostalMime {
  static {
    __name(this, "PostalMime");
  }
  // async so that an invalid option rejects the returned promise instead of throwing
  // synchronously, which would escape a `.catch()` chain
  static async parse(buf, options) {
    const parser = new _PostalMime(options);
    return parser.parse(buf);
  }
  // rfc822NestingDepth is internal state that nested parsers receive from their parent.
  // It is deliberately a separate argument rather than an option, so that forwarding a
  // caller supplied options object can not seed it and switch the recursion limit off.
  constructor(options, rfc822NestingDepth = 0) {
    this.options = options || {};
    this.mimeOptions = {
      maxNestingDepth: parseLimitOption(this.options.maxNestingDepth, MAX_NESTING_DEPTH, "maxNestingDepth"),
      maxHeadersSize: parseLimitOption(this.options.maxHeadersSize, MAX_HEADERS_SIZE, "maxHeadersSize")
    };
    this.maxRfc822NestingDepth = parseLimitOption(
      this.options.maxRfc822NestingDepth,
      MAX_RFC822_NESTING_DEPTH,
      "maxRfc822NestingDepth"
    );
    this.rfc822NestingDepth = rfc822NestingDepth;
    this.root = this.currentNode = new MimeNode({
      postalMime: this,
      ...this.mimeOptions
    });
    this.boundaries = [];
    this.textContent = {};
    this.attachments = [];
    this.attachmentEncoding = (this.options.attachmentEncoding || "").toString().replace(/[-_\s]/g, "").trim().toLowerCase() || "arraybuffer";
    this.started = false;
  }
  async finalize() {
    await this.root.finalize();
  }
  async processLine(line, isFinal) {
    let boundaries = this.boundaries;
    if (boundaries.length && line.length > 2 && line[0] === 45 && line[1] === 45) {
      for (let i = boundaries.length - 1; i >= 0; i--) {
        let boundary = boundaries[i];
        if (line.length < boundary.value.length + 2) {
          continue;
        }
        let boundaryMatches = true;
        for (let j = 0; j < boundary.value.length; j++) {
          if (line[j + 2] !== boundary.value[j]) {
            boundaryMatches = false;
            break;
          }
        }
        if (!boundaryMatches) {
          continue;
        }
        let boundaryEnd = boundary.value.length + 2;
        let isTerminator = false;
        if (line.length >= boundary.value.length + 4 && line[boundary.value.length + 2] === 45 && line[boundary.value.length + 3] === 45) {
          isTerminator = true;
          boundaryEnd = boundary.value.length + 4;
        }
        let hasValidTrailing = true;
        for (let j = boundaryEnd; j < line.length; j++) {
          if (line[j] !== 32 && line[j] !== 9) {
            hasValidTrailing = false;
            break;
          }
        }
        if (!hasValidTrailing) {
          continue;
        }
        if (isTerminator) {
          await boundary.node.finalize();
          this.currentNode = boundary.node.parentNode || this.root;
        } else {
          await boundary.node.finalizeChildNodes();
          this.currentNode = new MimeNode({
            postalMime: this,
            parentNode: boundary.node,
            parentMultipartType: boundary.node.contentType.multipart,
            ...this.mimeOptions
          });
        }
        if (isFinal) {
          return this.finalize();
        }
        return;
      }
    }
    this.currentNode.feed(line);
    if (isFinal) {
      return this.finalize();
    }
  }
  readLine() {
    let startPos = this.readPos;
    let endPos = this.readPos;
    while (this.readPos < this.av.length) {
      const c = this.av[this.readPos++];
      if (c !== 13 && c !== 10) {
        endPos = this.readPos;
      }
      if (c === 10) {
        return {
          bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
          done: this.readPos >= this.av.length
        };
      }
    }
    return {
      bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
      done: this.readPos >= this.av.length
    };
  }
  async processNodeTree() {
    let textContent = {};
    let textTypes = /* @__PURE__ */ new Set();
    let textMap = this.textMap = /* @__PURE__ */ new Map();
    let forceRfc822Attachments = this.forceRfc822Attachments();
    let walk = /* @__PURE__ */ __name(async (node, alternative, related) => {
      alternative = alternative || false;
      related = related || false;
      if (!node.contentType.multipart) {
        const inlineRfc822 = this.isInlineMessageRfc822(node) && !forceRfc822Attachments;
        const rfc822DepthExceeded = inlineRfc822 && this.rfc822NestingDepth >= this.maxRfc822NestingDepth;
        if (inlineRfc822 && !rfc822DepthExceeded) {
          const subParser = new _PostalMime(
            {
              // Only the limits are inherited. Options that decide how a part
              // is classified stay with the parser that was configured.
              ...this.mimeOptions,
              maxRfc822NestingDepth: this.maxRfc822NestingDepth,
              // attachments are encoded by the parent parser, keep raw buffers here
              attachmentEncoding: "arraybuffer"
            },
            this.rfc822NestingDepth + 1
          );
          node.subMessage = await subParser.parse(node.content);
          if (!textMap.has(node)) {
            textMap.set(node, {});
          }
          let textEntry = textMap.get(node);
          if (node.subMessage.text || !node.subMessage.html) {
            textEntry.plain = textEntry.plain || [];
            textEntry.plain.push({ type: "subMessage", value: node.subMessage });
            textTypes.add("plain");
          }
          if (node.subMessage.html) {
            textEntry.html = textEntry.html || [];
            textEntry.html.push({ type: "subMessage", value: node.subMessage });
            textTypes.add("html");
          }
          if (subParser.textMap) {
            subParser.textMap.forEach((subTextEntry, subTextNode) => {
              textMap.set(subTextNode, subTextEntry);
            });
          }
          for (let attachment of node.subMessage.attachments || []) {
            this.attachments.push(attachment);
          }
        } else if (this.isInlineTextNode(node)) {
          let textType = node.contentType.parsed.value.substr(node.contentType.parsed.value.indexOf("/") + 1);
          let selectorNode = alternative || node;
          if (!textMap.has(selectorNode)) {
            textMap.set(selectorNode, {});
          }
          let textEntry = textMap.get(selectorNode);
          textEntry[textType] = textEntry[textType] || [];
          textEntry[textType].push({ type: "text", value: node.getTextContent() });
          textTypes.add(textType);
        } else if (node.content) {
          const filename = node.contentDisposition?.parsed?.params?.filename || node.contentType.parsed.params.name || null;
          const attachment = {
            filename: filename ? decodeWords(filename) : null,
            mimeType: node.contentType.parsed.value,
            disposition: node.contentDisposition?.parsed?.value || null
          };
          if (related && node.contentId && !rfc822DepthExceeded) {
            attachment.related = true;
          }
          if (rfc822DepthExceeded) {
            attachment.rfc822DepthExceeded = true;
          }
          if (node.contentDescription) {
            attachment.description = node.contentDescription;
          }
          if (node.contentId) {
            attachment.contentId = node.contentId;
          }
          switch (node.contentType.parsed.value) {
            // Special handling for calendar events
            case "text/calendar":
            case "application/ics": {
              if (node.contentType.parsed.params.method) {
                attachment.method = node.contentType.parsed.params.method.toString().toUpperCase().trim();
              }
              const decodedText = node.getTextContent().replace(/\r?\n/g, "\n").replace(/\n*$/, "\n");
              attachment.content = textEncoder.encode(decodedText);
              break;
            }
            // Regular attachments
            default:
              attachment.content = node.content;
          }
          this.attachments.push(attachment);
        }
      } else if (node.contentType.multipart === "alternative") {
        alternative = node;
      } else if (node.contentType.multipart === "related") {
        related = node;
      }
      for (let childNode of node.childNodes) {
        await walk(childNode, alternative, related);
      }
    }, "walk");
    await walk(this.root, false, false);
    textMap.forEach((mapEntry) => {
      textTypes.forEach((textType) => {
        if (!textContent[textType]) {
          textContent[textType] = [];
        }
        if (mapEntry[textType]) {
          mapEntry[textType].forEach((textEntry) => {
            switch (textEntry.type) {
              case "text":
                textContent[textType].push(textEntry.value);
                break;
              case "subMessage":
                {
                  switch (textType) {
                    case "html":
                      textContent[textType].push(formatHtmlHeader(textEntry.value));
                      break;
                    case "plain":
                      textContent[textType].push(formatTextHeader(textEntry.value));
                      break;
                  }
                }
                break;
            }
          });
        } else {
          let alternativeType;
          switch (textType) {
            case "html":
              alternativeType = "plain";
              break;
            case "plain":
              alternativeType = "html";
              break;
          }
          (mapEntry[alternativeType] || []).forEach((textEntry) => {
            switch (textEntry.type) {
              case "text":
                switch (textType) {
                  case "html":
                    textContent[textType].push(textToHtml(textEntry.value));
                    break;
                  case "plain":
                    textContent[textType].push(htmlToText(textEntry.value));
                    break;
                }
                break;
              case "subMessage":
                {
                  switch (textType) {
                    case "html":
                      textContent[textType].push(formatHtmlHeader(textEntry.value));
                      break;
                    case "plain":
                      textContent[textType].push(formatTextHeader(textEntry.value));
                      break;
                  }
                }
                break;
            }
          });
        }
      });
    });
    Object.keys(textContent).forEach((textType) => {
      textContent[textType] = textContent[textType].join("\n");
    });
    this.textContent = textContent;
  }
  isInlineTextNode(node) {
    if (node.contentDisposition?.parsed?.value === "attachment") {
      return false;
    }
    switch (node.contentType.parsed?.value) {
      case "text/html":
      case "text/plain":
        return true;
      case "text/calendar":
      case "text/csv":
      default:
        return false;
    }
  }
  isInlineMessageRfc822(node) {
    if (node.contentType.parsed?.value !== "message/rfc822") {
      return false;
    }
    let disposition = node.contentDisposition?.parsed?.value || (this.options.rfc822Attachments ? "attachment" : "inline");
    return disposition === "inline";
  }
  // Check if this is a specially crafted report email where message/rfc822 content should not be inlined
  forceRfc822Attachments() {
    if (this.options.forceRfc822Attachments) {
      return true;
    }
    let forceRfc822Attachments = false;
    let walk = /* @__PURE__ */ __name((node) => {
      if (!node.contentType.multipart) {
        if (node.contentType.parsed && ["message/delivery-status", "message/feedback-report"].includes(node.contentType.parsed.value)) {
          forceRfc822Attachments = true;
        }
      }
      for (let childNode of node.childNodes) {
        walk(childNode);
      }
    }, "walk");
    walk(this.root);
    return forceRfc822Attachments;
  }
  async resolveStream(stream) {
    let chunkLen = 0;
    let chunks = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      chunkLen += value.length;
    }
    const result = new Uint8Array(chunkLen);
    let chunkPointer = 0;
    for (let chunk of chunks) {
      result.set(chunk, chunkPointer);
      chunkPointer += chunk.length;
    }
    return result;
  }
  async parse(buf) {
    if (this.started) {
      throw new Error("Can not reuse parser, create a new PostalMime object");
    }
    this.started = true;
    if (buf && typeof buf.getReader === "function") {
      buf = await this.resolveStream(buf);
    }
    buf = buf || new ArrayBuffer(0);
    if (typeof buf === "string") {
      buf = textEncoder.encode(buf);
    }
    if (buf instanceof Blob || Object.prototype.toString.call(buf) === "[object Blob]") {
      buf = await blobToArrayBuffer(buf);
    }
    if (buf.buffer instanceof ArrayBuffer) {
      buf = new Uint8Array(buf).buffer;
    }
    this.buf = buf;
    this.av = new Uint8Array(buf);
    this.readPos = 0;
    while (this.readPos < this.av.length) {
      const line = this.readLine();
      await this.processLine(line.bytes, line.done);
    }
    await this.processNodeTree();
    const message = {
      headers: this.root.headers.map((entry) => ({ key: entry.key, originalKey: entry.originalKey, value: entry.value })).reverse()
    };
    for (const key of ["from", "sender"]) {
      const addressHeader = this.root.headers.find((line) => line.key === key);
      if (addressHeader && addressHeader.value) {
        const addresses2 = address_parser_default(addressHeader.value);
        if (addresses2 && addresses2.length) {
          message[key] = addresses2[0];
        }
      }
    }
    for (const key of ["delivered-to", "return-path"]) {
      const addressHeader = this.root.headers.find((line) => line.key === key);
      if (addressHeader && addressHeader.value) {
        const addresses2 = address_parser_default(addressHeader.value);
        if (addresses2 && addresses2.length && addresses2[0].address) {
          const camelKey = toCamelCase2(key);
          message[camelKey] = addresses2[0].address;
        }
      }
    }
    for (const key of ["to", "cc", "bcc", "reply-to"]) {
      const addressHeaders = this.root.headers.filter((line) => line.key === key);
      let addresses2 = [];
      addressHeaders.filter((entry) => entry && entry.value).map((entry) => address_parser_default(entry.value)).forEach((parsed) => addresses2 = addresses2.concat(parsed || []));
      if (addresses2 && addresses2.length) {
        const camelKey = toCamelCase2(key);
        message[camelKey] = addresses2;
      }
    }
    for (const key of ["subject", "message-id", "in-reply-to", "references"]) {
      const header = this.root.headers.find((line) => line.key === key);
      if (header && header.value) {
        const camelKey = toCamelCase2(key);
        message[camelKey] = decodeWords(header.value);
      }
    }
    let dateHeader = this.root.headers.find((line) => line.key === "date");
    if (dateHeader) {
      let date = new Date(dateHeader.value);
      if (date.toString() === "Invalid Date") {
        date = dateHeader.value;
      } else {
        date = date.toISOString();
      }
      message.date = date;
    }
    if (this.textContent?.html) {
      message.html = this.textContent.html;
    }
    if (this.textContent?.plain) {
      message.text = this.textContent.plain;
    }
    message.attachments = this.attachments;
    message.headerLines = (this.root.rawHeaderLines || []).slice().reverse();
    switch (this.attachmentEncoding) {
      case "arraybuffer":
        break;
      case "base64":
        for (let attachment of message.attachments || []) {
          if (attachment?.content) {
            attachment.content = base64ArrayBuffer(attachment.content);
            attachment.encoding = "base64";
          }
        }
        break;
      case "utf8":
        let attachmentDecoder = new TextDecoder("utf8");
        for (let attachment of message.attachments || []) {
          if (attachment?.content) {
            attachment.content = attachmentDecoder.decode(attachment.content);
            attachment.encoding = "utf8";
          }
        }
        break;
      default:
        throw new Error("Unknown attachment encoding");
    }
    return message;
  }
};

// src/lib/mime-parse.ts
function decodeMimeHeader(value) {
  if (!value?.trim()) return "";
  return decodeWords(value).trim();
}
__name(decodeMimeHeader, "decodeMimeHeader");
function collectAddresses(entries) {
  if (!entries?.length) return [];
  const seen = /* @__PURE__ */ new Set();
  const emails = [];
  for (const entry of entries) {
    const mailboxes = entry.group?.length ? entry.group : entry.address ? [{ name: entry.name, address: entry.address }] : [];
    for (const mailbox of mailboxes) {
      const address = mailbox.address?.trim();
      if (!address) continue;
      const key = address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      emails.push(address);
    }
  }
  return emails;
}
__name(collectAddresses, "collectAddresses");
function pickFromAddress(entry) {
  if (!entry) return { name: "", address: "" };
  if (entry.group?.length) {
    const first = entry.group[0];
    return {
      name: decodeMimeHeader(first?.name ?? "") || "",
      address: first?.address?.trim() ?? ""
    };
  }
  return {
    name: decodeMimeHeader(entry.name ?? "") || "",
    address: entry.address?.trim() ?? ""
  };
}
__name(pickFromAddress, "pickFromAddress");
function attachmentBytes(content) {
  if (typeof content === "string") {
    return new TextEncoder().encode(content).buffer;
  }
  const bytes = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
__name(attachmentBytes, "attachmentBytes");
function normalizeContentId(value) {
  if (!value?.trim()) return null;
  return value.replace(/^<|>$/g, "").trim() || null;
}
__name(normalizeContentId, "normalizeContentId");
async function parseInboundMime(raw2) {
  const parser = new PostalMime();
  const email = await parser.parse(raw2);
  const attachments = (email.attachments ?? []).map(
    (attachment, index2) => {
      const content = attachmentBytes(attachment.content);
      return {
        id: String(index2),
        filename: decodeMimeHeader(attachment.filename) || `attachment-${index2 + 1}`,
        contentType: attachment.mimeType?.trim() || "application/octet-stream",
        size: content.byteLength,
        disposition: attachment.disposition?.trim() || "attachment",
        contentId: normalizeContentId(attachment.contentId),
        content
      };
    }
  );
  const subject = decodeMimeHeader(email.subject) || decodeMimeHeader(email.headers.find((header) => header.key === "subject")?.value);
  const from = pickFromAddress(email.from ?? email.sender);
  return {
    subject,
    bodyText: email.text?.trim() ?? "",
    bodyHtml: email.html?.trim() || null,
    fromEmail: from.address,
    fromName: from.name,
    toEmails: collectAddresses(email.to),
    ccEmails: collectAddresses(email.cc),
    attachments
  };
}
__name(parseInboundMime, "parseInboundMime");

// src/lib/mailbox-store.ts
init_mime();

// db/mail/search.ts
init_drizzle_orm();
var TABLE = "mailbox_fts";
var MAX_SEARCH_LIMIT = 200;
var MAX_BODY_TEXT = 1e5;
function buildMailboxFtsQuery(raw2) {
  const tokens = raw2.trim().split(/\s+/).map((token) => token.replace(/"/g, '""')).filter((token) => /[^\s*]/.test(token));
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token}"*`).join(" ");
}
__name(buildMailboxFtsQuery, "buildMailboxFtsQuery");
function parseSearchCursor(before) {
  const raw2 = before?.trim();
  if (!raw2) return null;
  const sep = raw2.lastIndexOf("|");
  if (sep <= 0) return { occurredAt: raw2, id: null };
  return { occurredAt: raw2.slice(0, sep), id: raw2.slice(sep + 1) || null };
}
__name(parseSearchCursor, "parseSearchCursor");
async function upsertMailboxFts(db, rows) {
  if (!db || rows.length === 0) return;
  for (const row of rows) {
    await db.run(sql`DELETE FROM ${sql.raw(TABLE)} WHERE id = ${row.id}`);
    await db.run(
      sql`INSERT INTO ${sql.raw(TABLE)} (
        id, kind, domain, subject, from_email, from_name, to_emails,
        cc_emails, body_text
      ) VALUES (
        ${row.id}, ${row.kind}, ${row.domain}, ${row.subject},
        ${row.from_email}, ${row.from_name}, ${row.to_emails},
        ${row.cc_emails}, ${(row.body_text ?? "").slice(0, MAX_BODY_TEXT)}
      )`
    );
  }
}
__name(upsertMailboxFts, "upsertMailboxFts");
async function deleteMailboxFts(db, ids) {
  if (!db || ids.length === 0) return;
  for (const id of ids) {
    await db.run(sql`DELETE FROM ${sql.raw(TABLE)} WHERE id = ${id}`);
  }
}
__name(deleteMailboxFts, "deleteMailboxFts");
async function searchMailbox(db, options) {
  const domains2 = options.domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean);
  const match2 = buildMailboxFtsQuery(options.q);
  if (!db || domains2.length === 0 || !match2) {
    return { rows: [], total: 0, nextBefore: null, hasMore: false };
  }
  const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_SEARCH_LIMIT);
  const cursor = parseSearchCursor(options.before);
  const account = options.account?.trim().toLowerCase() || null;
  const kind = options.kind ?? null;
  const raw2 = db.$client;
  const conditions = [`${TABLE} MATCH ?`, `${TABLE}.domain IN (${domains2.map(() => "?").join(", ")})`];
  const baseParams = [match2, ...domains2];
  if (kind) {
    conditions.push(`${TABLE}.kind = ?`);
    baseParams.push(kind);
  }
  if (account) {
    conditions.push(`(',' || mailbox_messages.recipients || ',') LIKE ?`);
    baseParams.push(`%,${account},%`);
  }
  const joinFrom = `${TABLE} INNER JOIN mailbox_messages ON ${TABLE}.id = mailbox_messages.id`;
  const countSql = `SELECT COUNT(*) AS total FROM ${joinFrom} WHERE ${conditions.join(" AND ")}`;
  const countParams = [...baseParams];
  const pageConditions = [...conditions];
  const pageParams = [...baseParams];
  if (cursor) {
    if (cursor.id) {
      pageConditions.push(
        `(mailbox_messages.occurred_at < ? OR (mailbox_messages.occurred_at = ? AND mailbox_messages.id < ?))`
      );
      pageParams.push(cursor.occurredAt, cursor.occurredAt, cursor.id);
    } else {
      pageConditions.push(`mailbox_messages.occurred_at < ?`);
      pageParams.push(cursor.occurredAt);
    }
  }
  const pageSql = `SELECT mailbox_messages.id, mailbox_messages.kind, mailbox_messages.domain,
      mailbox_messages.from_email, mailbox_messages.from_name, mailbox_messages.to_email,
      mailbox_messages.to_emails, mailbox_messages.cc_emails, mailbox_messages.recipients,
      mailbox_messages.subject, mailbox_messages.body_preview, mailbox_messages.occurred_at,
      mailbox_messages.message_id, mailbox_messages.in_reply_to, mailbox_messages.refs,
      mailbox_messages.size, mailbox_messages.attachment_count, mailbox_messages.read_at,
      mailbox_messages.r2_prefix
    FROM ${joinFrom}
    WHERE ${pageConditions.join(" AND ")}
    ORDER BY mailbox_messages.occurred_at DESC, mailbox_messages.id DESC
    LIMIT ?`;
  pageParams.push(limit + 1);
  try {
    const [countResult, pageResult] = await Promise.all([
      raw2.prepare(countSql).bind(...countParams).all(),
      raw2.prepare(pageSql).bind(...pageParams).all()
    ]);
    const total = Number(countResult.results?.[0]?.total ?? 0);
    const rows = pageResult.results ?? [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      rows: page,
      total,
      nextBefore: hasMore && last ? `${last.occurred_at}|${last.id}` : null,
      hasMore
    };
  } catch (error) {
    console.error("Failed to search mailbox", error);
    return { rows: [], total: 0, nextBefore: null, hasMore: false };
  }
}
__name(searchMailbox, "searchMailbox");

// src/lib/mailbox-store.ts
init_messages();
var PRUNE_BATCH_LIMIT = 50;
var INBOUND_PREFIX = "inbound";
var SENT_PREFIX = "sent";
var JSON_META2 = { httpMetadata: { contentType: "application/json" } };
var EML_META = { httpMetadata: { contentType: "message/rfc822" } };
function domainFromAddress(address) {
  const at = address.lastIndexOf("@");
  return at >= 0 ? address.slice(at + 1).trim().toLowerCase() : "";
}
__name(domainFromAddress, "domainFromAddress");
function prefixFor(kind) {
  return kind === "sent" ? SENT_PREFIX : INBOUND_PREFIX;
}
__name(prefixFor, "prefixFor");
function objectPrefix(kind, domain, id) {
  return `${prefixFor(kind)}/${domain}/${id}`;
}
__name(objectPrefix, "objectPrefix");
function metaObjectKey(kind, domain, id) {
  return `${objectPrefix(kind, domain, id)}/meta.json`;
}
__name(metaObjectKey, "metaObjectKey");
function rawObjectKey(kind, domain, id) {
  return `${objectPrefix(kind, domain, id)}/raw.eml`;
}
__name(rawObjectKey, "rawObjectKey");
function attachmentObjectKey(kind, domain, id, attachmentId, filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `${objectPrefix(kind, domain, id)}/attachments/${attachmentId}-${safeName}`;
}
__name(attachmentObjectKey, "attachmentObjectKey");
function messageIdIndexKey(kind, domain, normalizedMessageId) {
  return `${prefixFor(kind)}/${domain}/by-message-id/${encodeURIComponent(normalizedMessageId)}`;
}
__name(messageIdIndexKey, "messageIdIndexKey");
function normalizeInboundMessageId(raw2) {
  if (!raw2) return null;
  const trimmed = raw2.trim().toLowerCase();
  if (!trimmed) return null;
  const unwrapped = trimmed.startsWith("<") && trimmed.endsWith(">") ? trimmed.slice(1, -1).trim() : trimmed;
  return unwrapped || null;
}
__name(normalizeInboundMessageId, "normalizeInboundMessageId");
function previewText(text2, max = 500) {
  const normalized = text2.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}\u2026`;
}
__name(previewText, "previewText");
function joinAddressList(value) {
  return (value ?? []).map((entry) => entry.trim()).filter(Boolean).join(",");
}
__name(joinAddressList, "joinAddressList");
function normalizeThinMeta(meta) {
  return {
    ...meta,
    attachments: meta.attachments ?? [],
    toEmails: meta.toEmails && meta.toEmails.length > 0 ? meta.toEmails : meta.toEmail ? [meta.toEmail] : [],
    ccEmails: meta.ccEmails ?? [],
    readAt: meta.kind === "sent" ? null : meta.readAt ?? null
  };
}
__name(normalizeThinMeta, "normalizeThinMeta");
function thinMetaToRow(meta) {
  return {
    id: meta.id,
    kind: meta.kind,
    domain: meta.domain,
    from_email: meta.fromEmail,
    from_name: meta.fromName ?? null,
    to_email: meta.toEmail,
    to_emails: joinAddressList(meta.toEmails),
    cc_emails: joinAddressList(meta.ccEmails),
    recipients: recipientsColumn({
      toEmail: meta.toEmail,
      toEmails: meta.toEmails,
      ccEmails: meta.ccEmails
    }),
    subject: meta.subject,
    body_preview: meta.bodyPreview,
    occurred_at: meta.occurredAt,
    message_id: meta.messageId,
    in_reply_to: meta.inReplyTo,
    refs: meta.references,
    size: meta.size,
    attachment_count: meta.attachments?.length ?? 0,
    read_at: meta.readAt ?? null,
    r2_prefix: objectPrefix(meta.kind, meta.domain, meta.id)
  };
}
__name(thinMetaToRow, "thinMetaToRow");
function thinMetaToInboundMeta(meta, bodyText) {
  return {
    id: meta.id,
    domain: meta.domain,
    fromEmail: meta.fromEmail,
    fromName: meta.fromName,
    toEmail: meta.toEmail,
    toEmails: meta.toEmails,
    ccEmails: meta.ccEmails,
    subject: meta.subject,
    receivedAt: meta.occurredAt,
    messageId: meta.messageId,
    inReplyTo: meta.inReplyTo,
    references: meta.references,
    size: meta.size,
    bodyPreview: meta.bodyPreview,
    bodyText,
    bodyHtml: null,
    attachments: meta.attachments ?? [],
    readAt: meta.readAt ?? null
  };
}
__name(thinMetaToInboundMeta, "thinMetaToInboundMeta");
async function writeMessageIdIndex(bucket, kind, domain, normalizedMessageId, id) {
  await bucket.put(
    messageIdIndexKey(kind, domain, normalizedMessageId),
    id,
    { httpMetadata: { contentType: "text/plain" } }
  );
}
__name(writeMessageIdIndex, "writeMessageIdIndex");
async function readMessageIdIndex(bucket, kind, domain, normalizedMessageId) {
  const object = await bucket.get(
    messageIdIndexKey(kind, domain, normalizedMessageId)
  );
  if (!object) return null;
  const id = (await object.text()).trim();
  return id || null;
}
__name(readMessageIdIndex, "readMessageIdIndex");
async function loadThinMeta(bucket, kind, domain, id) {
  const object = await bucket.get(metaObjectKey(kind, domain, id));
  if (!object) return null;
  try {
    const meta = JSON.parse(await object.text());
    return normalizeThinMeta(meta);
  } catch {
    return null;
  }
}
__name(loadThinMeta, "loadThinMeta");
async function deleteMessageObjects(bucket, kind, domain, id) {
  const prefix = `${objectPrefix(kind, domain, id)}/`;
  let cursor;
  do {
    const listed = await bucket.list({ prefix, cursor });
    for (const object of listed.objects) {
      await bucket.delete(object.key);
    }
    cursor = listed.truncated ? listed.cursor : void 0;
  } while (cursor);
}
__name(deleteMessageObjects, "deleteMessageObjects");
async function indexMessage(mailDb, meta, bodyText) {
  if (!mailDb) return;
  await upsertMailboxMessage(mailDb, thinMetaToRow(meta));
  await upsertMailboxFts(mailDb, [
    {
      id: meta.id,
      kind: meta.kind,
      domain: meta.domain,
      subject: meta.subject,
      from_email: meta.fromEmail,
      from_name: meta.fromName ?? null,
      to_emails: joinAddressList(meta.toEmails),
      cc_emails: joinAddressList(meta.ccEmails),
      body_text: bodyText
    }
  ]);
}
__name(indexMessage, "indexMessage");
async function storeInboundMail(bucket, params, mailDb) {
  const receivedAt = (/* @__PURE__ */ new Date()).toISOString();
  const domain = domainFromAddress(params.toEmail);
  if (!domain) {
    throw new Error("Inbound email is missing a recipient domain");
  }
  const normalizedMessageId = normalizeInboundMessageId(params.messageId);
  if (normalizedMessageId) {
    const existingId = await readMessageIdIndex(
      bucket,
      "inbound",
      domain,
      normalizedMessageId
    );
    if (existingId) {
      const existing = await loadThinMeta(bucket, "inbound", domain, existingId);
      if (existing) {
        return {
          record: thinMetaToInboundMeta(existing, ""),
          created: false
        };
      }
    }
  }
  const id = crypto.randomUUID();
  const parsed = await parseInboundMime(params.raw);
  const attachmentMeta = [];
  for (const attachment of parsed.attachments) {
    await bucket.put(
      attachmentObjectKey("inbound", domain, id, attachment.id, attachment.filename),
      attachment.content,
      {
        httpMetadata: { contentType: attachment.contentType },
        customMetadata: {
          filename: attachment.filename,
          disposition: attachment.disposition
        }
      }
    );
    attachmentMeta.push({
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      disposition: attachment.disposition,
      contentId: attachment.contentId
    });
  }
  const subject = parsed.subject || decodeMimeHeader(params.subject) || "(no subject)";
  const isBounce = isBounceMessage(params.raw, params.envelopeFrom);
  const bounceDiagnostic = isBounce ? parseBounceDiagnostic(params.raw) : null;
  const bouncePreview = bounceDiagnostic ? buildBouncePreview(bounceDiagnostic) : null;
  const bodyText = parsed.bodyText || (isBounce ? bouncePreview ?? "(empty message)" : "");
  const bodyPreview = previewText(
    bodyText || params.subject || (isBounce ? "Bounce notification" : "")
  );
  const toEmails = parsed.toEmails.length ? parsed.toEmails : [params.toEmail];
  const fromEmail = parsed.fromEmail || params.envelopeFrom;
  const fromName = parsed.fromName;
  const thin = {
    id,
    kind: "inbound",
    domain,
    fromEmail,
    fromName,
    toEmail: params.toEmail,
    toEmails,
    ccEmails: parsed.ccEmails,
    subject,
    occurredAt: receivedAt,
    messageId: params.messageId,
    inReplyTo: params.inReplyTo ?? null,
    references: params.references ?? null,
    size: params.size,
    bodyPreview,
    attachments: attachmentMeta,
    readAt: null,
    hasText: Boolean(parsed.bodyText),
    hasHtml: Boolean(parsed.bodyHtml)
  };
  await bucket.put(
    metaObjectKey("inbound", domain, id),
    JSON.stringify(thin),
    JSON_META2
  );
  const rawBody = attachmentMeta.length > 0 ? buildStrippedInboundMime({
    fromEmail,
    fromName,
    toEmail: params.toEmail,
    ccEmails: parsed.ccEmails,
    subject,
    messageId: params.messageId,
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    attachments: attachmentMeta
  }) : params.raw;
  await bucket.put(rawObjectKey("inbound", domain, id), rawBody, {
    ...EML_META,
    customMetadata: {
      from: params.envelopeFrom,
      to: params.toEmail,
      domain
    }
  });
  if (normalizedMessageId) {
    await writeMessageIdIndex(bucket, "inbound", domain, normalizedMessageId, id);
  }
  try {
    await indexMessage(mailDb, thin, bodyText);
  } catch (error) {
    console.error("Failed to index inbound email", error);
  }
  return {
    record: thinMetaToInboundMeta(thin, bodyText),
    created: true
  };
}
__name(storeInboundMail, "storeInboundMail");
async function storeSentMail(bucket, params, mailDb) {
  const domain = domainFromAddress(params.from);
  if (!domain) {
    throw new Error("Sent email is missing a sender domain");
  }
  const sentAt = params.sentAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const id = params.messageId?.trim() || crypto.randomUUID();
  const normalizedMessageId = normalizeInboundMessageId(params.messageId);
  if (normalizedMessageId) {
    const existingId = await readMessageIdIndex(
      bucket,
      "sent",
      domain,
      normalizedMessageId
    );
    if (existingId && existingId !== id) {
      const existing = await loadThinMeta(bucket, "sent", domain, existingId);
      if (existing) {
        return { record: existing, created: false };
      }
    }
  }
  const rawMime = params.rawMime ?? buildSentMime({
    from: params.from,
    fromName: params.fromName,
    to: params.to,
    cc: params.cc,
    subject: params.subject,
    text: params.text,
    html: params.html,
    messageId: params.messageId,
    inReplyTo: params.inReplyTo,
    references: params.references
  });
  const rawBytes = new TextEncoder().encode(rawMime);
  const thin = {
    id,
    kind: "sent",
    domain,
    fromEmail: params.from,
    fromName: params.fromName,
    toEmail: params.to[0] ?? params.from,
    toEmails: params.to,
    ccEmails: params.cc ?? [],
    subject: params.subject,
    occurredAt: sentAt,
    messageId: params.messageId,
    inReplyTo: params.inReplyTo ?? null,
    references: params.references ?? null,
    size: rawBytes.byteLength,
    bodyPreview: previewText(params.text),
    attachments: [],
    readAt: null,
    hasText: Boolean(params.text),
    hasHtml: Boolean(params.html?.trim())
  };
  await bucket.put(
    metaObjectKey("sent", domain, id),
    JSON.stringify(thin),
    JSON_META2
  );
  await bucket.put(rawObjectKey("sent", domain, id), rawBytes, {
    ...EML_META,
    customMetadata: {
      from: params.from,
      to: params.to.join(", "),
      domain
    }
  });
  if (normalizedMessageId) {
    await writeMessageIdIndex(bucket, "sent", domain, normalizedMessageId, id);
  }
  try {
    await indexMessage(mailDb, thin, params.text);
  } catch (error) {
    console.error("Failed to index sent email", error);
  }
  return { record: thin, created: true };
}
__name(storeSentMail, "storeSentMail");
function buildSentMime(params) {
  return buildMimeMessage({
    from: params.from,
    fromName: params.fromName,
    to: params.to.length === 1 ? params.to[0] : params.to,
    cc: params.cc,
    subject: params.subject,
    text: params.text,
    html: params.html,
    messageId: params.messageId ?? void 0,
    inReplyTo: params.inReplyTo ?? void 0,
    references: params.references ?? void 0
  });
}
__name(buildSentMime, "buildSentMime");
async function getMailMessage(bucket, kind, domain, id) {
  const normalizedDomain = domain.trim().toLowerCase();
  const thin = await loadThinMeta(bucket, kind, normalizedDomain, id);
  if (!thin) return null;
  let bodyText = "";
  let bodyHtml = null;
  const rawObject = await bucket.get(
    rawObjectKey(kind, normalizedDomain, id)
  );
  if (rawObject) {
    try {
      const parsed = await parseInboundMime(await rawObject.arrayBuffer());
      bodyText = parsed.bodyText;
      bodyHtml = parsed.bodyHtml;
    } catch (error) {
      console.error("Failed to parse raw.eml for detail", error);
    }
  }
  const meta = thinMetaToInboundMeta(
    thin,
    bodyText || (rawObject ? "" : thin.bodyPreview)
  );
  meta.bodyHtml = bodyHtml;
  return meta;
}
__name(getMailMessage, "getMailMessage");
async function getInboundAttachment(bucket, params) {
  const domain = params.domain.trim().toLowerCase();
  const thin = await loadThinMeta(bucket, "inbound", domain, params.messageId);
  if (!thin) return null;
  const attachment = thin.attachments.find(
    (item) => item.id === params.attachmentId
  );
  if (!attachment) return null;
  const prefix = `${objectPrefix("inbound", domain, params.messageId)}/attachments/${attachment.id}-`;
  const listed = await bucket.list({ prefix, limit: 20 });
  const objectKey = listed.objects[0]?.key;
  if (!objectKey) return null;
  const object = await bucket.get(objectKey);
  if (!object) return null;
  return { meta: attachment, body: await object.arrayBuffer() };
}
__name(getInboundAttachment, "getInboundAttachment");
async function setMailReadState(bucket, domain, ids, readAt, mailDb) {
  const normalizedDomain = domain.trim().toLowerCase();
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const updated = [];
  await Promise.all(
    uniqueIds.map(async (id) => {
      const thin = await loadThinMeta(bucket, "inbound", normalizedDomain, id);
      if (!thin) return;
      const next = { ...thin, readAt };
      await bucket.put(
        metaObjectKey("inbound", normalizedDomain, id),
        JSON.stringify(next),
        JSON_META2
      );
      updated.push(id);
    })
  );
  if (updated.length > 0 && mailDb) {
    try {
      await updateMailboxReadState(mailDb, updated, readAt);
    } catch (error) {
      console.error("Failed to sync read state to mail index", error);
    }
  }
  return { updated };
}
__name(setMailReadState, "setMailReadState");
async function pruneMail(bucket, mailDb, kind, domain, keep, limit = PRUNE_BATCH_LIMIT) {
  if (!mailDb || keep <= 0) return 0;
  const normalizedDomain = domain.trim().toLowerCase();
  let staleIds = [];
  try {
    staleIds = await mailboxPruneIds(
      mailDb,
      kind,
      normalizedDomain,
      keep,
      limit
    );
  } catch (error) {
    console.error("Failed to compute prune ids", error);
    return 0;
  }
  if (staleIds.length === 0) return 0;
  for (const id of staleIds) {
    await deleteMessageObjects(bucket, kind, normalizedDomain, id);
  }
  try {
    await deleteMailboxMessages(mailDb, staleIds);
    await deleteMailboxFts(mailDb, staleIds);
  } catch (error) {
    console.error("Failed to prune mail index rows", error);
  }
  return staleIds.length;
}
__name(pruneMail, "pruneMail");
async function listMessageFolderIds(bucket, kind, domain) {
  const prefix = `${prefixFor(kind)}/${domain.trim().toLowerCase()}/`;
  const ids = [];
  let cursor;
  do {
    const listed = await bucket.list({ prefix, delimiter: "/", cursor });
    for (const folder of listed.delimitedPrefixes ?? []) {
      if (!folder.startsWith(prefix)) continue;
      const id = folder.slice(prefix.length).replace(/\/$/, "");
      if (!id || id.includes("/") || id === "by-message-id") continue;
      ids.push(id);
    }
    cursor = listed.truncated ? listed.cursor : void 0;
  } while (cursor);
  return ids;
}
__name(listMessageFolderIds, "listMessageFolderIds");
async function readJsonAt(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}
__name(readJsonAt, "readJsonAt");
async function readEmlBodyText(bucket, kind, domain, id) {
  try {
    const object = await bucket.get(rawObjectKey(kind, domain, id));
    if (!object) return "";
    const parsed = await parseInboundMime(await object.arrayBuffer());
    return parsed.bodyText;
  } catch {
    return "";
  }
}
__name(readEmlBodyText, "readEmlBodyText");
function stripFatMeta(meta) {
  const next = { ...meta };
  delete next.bodyText;
  delete next.bodyHtml;
  return next;
}
__name(stripFatMeta, "stripFatMeta");
async function rebuildDomain(bucket, mailDb, domain) {
  const normalized = domain.trim().toLowerCase();
  const deletedKeys = [];
  let inboundCount = 0;
  let sentCount = 0;
  const inboundDone = await mailboxIdsForDomain(mailDb, "inbound", normalized);
  const inboundIds = await listMessageFolderIds(bucket, "inbound", normalized);
  for (const id of inboundIds) {
    if (inboundDone.has(id)) {
      inboundCount += 1;
      continue;
    }
    const metaKey = metaObjectKey("inbound", normalized, id);
    const raw2 = await readJsonAt(bucket, metaKey);
    if (!raw2) continue;
    const fatHasText = Boolean(raw2.hasText ?? raw2.bodyText);
    const fatHasHtml = Boolean(raw2.hasHtml ?? raw2.bodyHtml);
    const stripped = stripFatMeta(raw2);
    const emlExists = Boolean(
      await bucket.head(rawObjectKey("inbound", normalized, id))
    );
    const thin = normalizeThinMeta({
      id,
      kind: "inbound",
      domain: normalized,
      fromEmail: stripped.fromEmail ?? "",
      fromName: stripped.fromName,
      toEmail: stripped.toEmail ?? "",
      toEmails: stripped.toEmails,
      ccEmails: stripped.ccEmails,
      subject: stripped.subject ?? "",
      occurredAt: stripped.occurredAt ?? stripped.receivedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
      messageId: stripped.messageId ?? null,
      inReplyTo: stripped.inReplyTo ?? null,
      references: stripped.references ?? null,
      size: stripped.size ?? 0,
      bodyPreview: previewText(stripped.bodyPreview ?? ""),
      attachments: stripped.attachments ?? [],
      readAt: stripped.readAt ?? null,
      hasText: fatHasText || emlExists,
      hasHtml: fatHasHtml || emlExists
    });
    await bucket.put(metaKey, JSON.stringify(thin), JSON_META2);
    const bodyText = await readEmlBodyText(bucket, "inbound", normalized, id);
    try {
      await indexMessage(mailDb, thin, bodyText);
    } catch (error) {
      console.error(`rebuild inbound index failed ${normalized}/${id}`, error);
    }
    inboundCount += 1;
  }
  const sentDone = await mailboxIdsForDomain(mailDb, "sent", normalized);
  const sentIds = await listMessageFolderIds(bucket, "sent", normalized);
  for (const id of sentIds) {
    if (sentDone.has(id)) {
      sentCount += 1;
      continue;
    }
    const metaKey = metaObjectKey("sent", normalized, id);
    const raw2 = await readJsonAt(bucket, metaKey);
    if (!raw2) continue;
    const stripped = stripFatMeta(raw2);
    const emlExists = Boolean(
      await bucket.head(rawObjectKey("sent", normalized, id))
    );
    const thin = normalizeThinMeta({
      id,
      kind: "sent",
      domain: normalized,
      fromEmail: stripped.fromEmail ?? "",
      fromName: stripped.fromName,
      toEmail: stripped.toEmail ?? "",
      toEmails: stripped.toEmails,
      ccEmails: stripped.ccEmails,
      subject: stripped.subject ?? "",
      occurredAt: stripped.occurredAt ?? stripped.sentAt ?? (/* @__PURE__ */ new Date()).toISOString(),
      messageId: stripped.messageId ?? null,
      inReplyTo: stripped.inReplyTo ?? null,
      references: stripped.references ?? null,
      size: stripped.size ?? 0,
      bodyPreview: previewText(stripped.bodyPreview ?? ""),
      attachments: stripped.attachments ?? [],
      hasText: Boolean(stripped.hasText) || emlExists,
      hasHtml: Boolean(stripped.hasHtml) || emlExists
    });
    await bucket.put(metaKey, JSON.stringify(thin), JSON_META2);
    const bodyText = await readEmlBodyText(bucket, "sent", normalized, id);
    try {
      await indexMessage(mailDb, thin, bodyText);
    } catch (error) {
      console.error(`rebuild sent index failed ${normalized}/${id}`, error);
    }
    sentCount += 1;
  }
  if (sentIds.length === 0) {
    const legacy = await readJsonAt(
      bucket,
      `sent/${normalized}/_list.json`
    );
    const legacySent = legacy ?? await readJsonAt(
      bucket,
      `inbound/${normalized}/_sent.json`
    );
    if (legacySent && Array.isArray(legacySent)) {
      for (const entry of legacySent) {
        const row = entry;
        const id = String(row.id ?? row.messageId ?? crypto.randomUUID());
        const fromEmail = String(row.from ?? "");
        const toEmails = Array.isArray(row.to) ? row.to : String(row.to ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const ccEmails = Array.isArray(row.cc) ? row.cc : String(row.cc ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const thin = normalizeThinMeta({
          id,
          kind: "sent",
          domain: normalized,
          fromEmail,
          fromName: row.fromName ? String(row.fromName) : void 0,
          toEmail: toEmails[0] ?? fromEmail,
          toEmails,
          ccEmails,
          subject: String(row.subject ?? ""),
          occurredAt: String(row.sentAt ?? (/* @__PURE__ */ new Date()).toISOString()),
          messageId: row.messageId ? String(row.messageId) : null,
          inReplyTo: row.inReplyTo ? String(row.inReplyTo) : null,
          references: row.references ? String(row.references) : null,
          size: Number(row.size ?? 0),
          bodyPreview: previewText(String(row.bodyPreview ?? "")),
          attachments: [],
          hasText: false,
          hasHtml: false
        });
        await bucket.put(
          metaObjectKey("sent", normalized, id),
          JSON.stringify(thin),
          JSON_META2
        );
        try {
          await indexMessage(mailDb, thin, thin.bodyPreview);
        } catch (error) {
          console.error(`rebuild sent legacy index failed ${normalized}/${id}`, error);
        }
        sentCount += 1;
      }
    }
  }
  const arrayKeys = [
    `inbound/${normalized}/_list.json`,
    `sent/${normalized}/_list.json`,
    `inbound/${normalized}/_sent.json`
  ];
  for (const key of arrayKeys) {
    const object = await bucket.head(key);
    if (object) {
      await bucket.delete(key);
      deletedKeys.push(key);
    }
  }
  return { domain: normalized, inbound: inboundCount, sent: sentCount, deletedKeys };
}
__name(rebuildDomain, "rebuildDomain");
async function deleteSendLogIndex(bucket) {
  const key = "sent/_sendlog/_index.json";
  const object = await bucket.head(key);
  if (object) {
    await bucket.delete(key);
    return true;
  }
  return false;
}
__name(deleteSendLogIndex, "deleteSendLogIndex");

// src/routes/console/rebuild-mail.ts
var consoleRebuildMail = new Hono2();
consoleRebuildMail.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index (RELAYBASE_MAIL) is not configured" }, 503);
  }
  if (!c.env.INBOUND) {
    return c.json({ error: "Mailbox R2 bucket (INBOUND) is not configured" }, 503);
  }
  const requestedDomain = c.req.query("domain")?.trim().toLowerCase() || null;
  const mailbox = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  const domains2 = requestedDomain ? mailbox.domains.filter((d) => d.toLowerCase() === requestedDomain) : mailbox.domains;
  if (domains2.length === 0) {
    return c.json({ error: "No matching domains found" }, 404);
  }
  const results = [];
  let totalInbound = 0;
  let totalSent = 0;
  const allDeletedKeys = [];
  for (const domain of domains2) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    const result = await rebuildDomain(c.env.INBOUND, mailDb, normalized);
    results.push(result);
    totalInbound += result.inbound;
    totalSent += result.sent;
    allDeletedKeys.push(...result.deletedKeys);
  }
  const sendLogIndexDeleted = await deleteSendLogIndex(c.env.INBOUND);
  if (sendLogIndexDeleted) {
    allDeletedKeys.push("sent/_sendlog/_index.json");
  }
  return c.json({
    domains: results,
    inbound: totalInbound,
    sent: totalSent,
    deletedKeys: allDeletedKeys
  });
});

// src/routes/console/register-owner.ts
init_app();
var consoleRegisterOwner = new Hono2();
var EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
consoleRegisterOwner.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const email = body.accountEmail?.trim().toLowerCase() ?? "";
  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") ?? "";
  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ error: "A valid accountEmail is required" }, 400);
  }
  if (!workerUrl || !/^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(workerUrl)) {
    return c.json({ error: "A valid https://*.workers.dev workerUrl is required" }, 400);
  }
  const db = createAppDb(c.env.RELAYBASE_DB);
  await setOwnerConfig(db, { ownerEmail: email, workerUrl });
  return c.json({ ok: true, ownerEmail: email, workerUrl });
});
consoleRegisterOwner.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const db = createAppDb(c.env.RELAYBASE_DB);
  const config = await getOwnerLoginConfig(db);
  return c.json({
    ok: true,
    ownerEmail: config?.ownerEmail ?? null,
    workerUrl: config?.workerUrl ?? null
  });
});

// src/routes/console/send-logs.ts
init_send_logs();
var consoleSendLogs = new Hono2();
consoleSendLogs.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const limit = Number(c.req.query("limit") ?? "100");
  const status = c.req.query("status") ?? "all";
  const domain = c.req.query("domain")?.trim();
  if (!["all", "failed", "success"].includes(status)) {
    return c.json({ error: "status must be all, failed, or success" }, 400);
  }
  const result = await listSendLogs(c.env.INBOUND, {
    limit: Number.isFinite(limit) ? limit : 100,
    status,
    domain: domain || void 0
  });
  return c.json({ ...result, workerConnected: true });
});

// src/routes/console/stats.ts
init_catalog_audience();
init_catalog_broadcasts();
init_catalog_store();
init_send_logs();
init_app();

// src/lib/stats-buckets.ts
var RANGE_MS = {
  "24h": 24 * 60 * 60 * 1e3,
  "7d": 7 * 24 * 60 * 60 * 1e3,
  "30d": 30 * 24 * 60 * 60 * 1e3
};
var RANGE_BUCKETS = {
  "24h": 24,
  "7d": 7,
  "30d": 30
};
function parseStatsRange(value) {
  if (value === "24h" || value === "7d" || value === "30d") return value;
  return "7d";
}
__name(parseStatsRange, "parseStatsRange");
function bucketLabel(date, range) {
  if (range === "24h") {
    return date.toLocaleTimeString("en-US", { hour: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
__name(bucketLabel, "bucketLabel");
function createBuckets(range, now = Date.now()) {
  const count3 = RANGE_BUCKETS[range];
  const span = RANGE_MS[range];
  const bucketMs = span / count3;
  const start = now - span;
  return Array.from({ length: count3 }, (_, index2) => {
    const at = start + index2 * bucketMs;
    return {
      label: bucketLabel(new Date(at + bucketMs / 2), range),
      at: new Date(at).toISOString(),
      value: 0
    };
  });
}
__name(createBuckets, "createBuckets");
function bucketIndex(timestamp, range, now = Date.now()) {
  const span = RANGE_MS[range];
  const count3 = RANGE_BUCKETS[range];
  const start = now - span;
  if (timestamp < start || timestamp > now) return null;
  const bucketMs = span / count3;
  return Math.min(count3 - 1, Math.floor((timestamp - start) / bucketMs));
}
__name(bucketIndex, "bucketIndex");
function incrementBucket(buckets, index2) {
  if (index2 === null || index2 < 0 || index2 >= buckets.length) return;
  buckets[index2].value += 1;
}
__name(incrementBucket, "incrementBucket");

// src/routes/console/stats.ts
var consoleStats = new Hono2();
function isApiSend(log) {
  return Boolean(log.keyId);
}
__name(isApiSend, "isApiSend");
function domainFromEmail(email) {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}
__name(domainFromEmail, "domainFromEmail");
async function listInboundRowsForAccount(c, domain, email) {
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) return [];
  const raw2 = mailDb.$client;
  const result = await raw2.prepare(
    `SELECT id, occurred_at, from_email, subject
       FROM mailbox_messages
       WHERE kind = 'inbound' AND domain = ?
         AND (',' || recipients || ',') LIKE ?
       ORDER BY occurred_at DESC
       LIMIT 5000`
  ).bind(domain, `%,${email},%`).all();
  return result.results ?? [];
}
__name(listInboundRowsForAccount, "listInboundRowsForAccount");
function sumBuckets(buckets) {
  return buckets.reduce((sum, b) => sum + b.value, 0);
}
__name(sumBuckets, "sumBuckets");
consoleStats.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const range = parseStatsRange(c.req.query("range"));
  const domain = c.req.query("domain")?.trim().toLowerCase() || null;
  const now = Date.now();
  const since = now - RANGE_MS[range];
  const [mailbox, audience, broadcasts2, sendLogs, keys] = await Promise.all([
    readMailbox2(createAppDb(c.env.RELAYBASE_DB)),
    readAudienceCatalog(createAppDb(c.env.RELAYBASE_DB)),
    readBroadcasts(createAppDb(c.env.RELAYBASE_DB)),
    listSendLogs(c.env.INBOUND, { limit: 500, domain: domain ?? void 0 }),
    listKeys2(createAppDb(c.env.RELAYBASE_DB))
  ]);
  const addresses2 = domain ? mailbox.addresses.filter((a) => a.domain === domain) : mailbox.addresses;
  const contacts = domain ? audience.contacts.filter((ct) => ct.domain === domain) : audience.contacts;
  const domainBroadcasts = domain ? broadcasts2.filter((b) => b.domain === domain) : broadcasts2;
  const domainKeys = domain ? keys.filter((k) => k.domain === domain) : keys;
  const sentBuckets = createBuckets(range, now);
  const requestBuckets = createBuckets(range, now);
  const errorBuckets = createBuckets(range, now);
  const apiEmailBuckets = createBuckets(range, now);
  const apiKeyBuckets = createBuckets(range, now);
  const keysUsedInRange = /* @__PURE__ */ new Set();
  const keysByBucket = /* @__PURE__ */ new Map();
  for (const log of sendLogs.logs) {
    const ts = new Date(log.at).getTime();
    if (Number.isNaN(ts) || ts < since) continue;
    const index2 = bucketIndex(ts, range, now);
    incrementBucket(sentBuckets, index2);
    incrementBucket(requestBuckets, index2);
    if (!log.ok) incrementBucket(errorBuckets, index2);
    if (isApiSend(log) && log.ok) incrementBucket(apiEmailBuckets, index2);
    if (log.keyId) {
      keysUsedInRange.add(log.keyId);
      if (index2 !== null) {
        const set = keysByBucket.get(index2) ?? /* @__PURE__ */ new Set();
        set.add(log.keyId);
        keysByBucket.set(index2, set);
      }
    }
  }
  for (const [index2, used] of keysByBucket) {
    if (index2 >= 0 && index2 < apiKeyBuckets.length) {
      apiKeyBuckets[index2].value = used.size;
    }
  }
  const drafts = domainBroadcasts.filter((b) => b.status === "draft").length;
  return c.json({
    domain,
    range,
    workerConnected: true,
    totals: {
      domains: domain ? 1 : mailbox.domains.length,
      addresses: addresses2.length,
      audience: contacts.length,
      broadcasts: domainBroadcasts.length,
      drafts,
      sent: sumBuckets(sentBuckets),
      apiKeys: domainKeys.length,
      apiKeysUsed: keysUsedInRange.size,
      requests: sumBuckets(requestBuckets),
      errors: sumBuckets(errorBuckets),
      apiEmails: sumBuckets(apiEmailBuckets)
    },
    series: {
      sent: sentBuckets,
      apiKeysUsed: apiKeyBuckets,
      requests: requestBuckets,
      errors: errorBuckets,
      apiEmails: apiEmailBuckets
    }
  });
});
consoleStats.get("/account-stats", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);
  const range = parseStatsRange(c.req.query("range"));
  const now = Date.now();
  const since = now - RANGE_MS[range];
  const domain = domainFromEmail(email);
  const [mailbox, sendLogs, inboundRows] = await Promise.all([
    readMailbox2(createAppDb(c.env.RELAYBASE_DB)),
    listSendLogs(c.env.INBOUND, { limit: 500 }),
    domain ? listInboundRowsForAccount(c, domain, email) : Promise.resolve([])
  ]);
  const address = mailbox.addresses.find((a) => a.email === email);
  const fromLogs = sendLogs.logs.filter(
    (l) => l.from?.toLowerCase() === email
  );
  const receivedMessages = inboundRows;
  const receivedBuckets = createBuckets(range, now);
  const sentBuckets = createBuckets(range, now);
  const apiEmailBuckets = createBuckets(range, now);
  const apiErrorBuckets = createBuckets(range, now);
  const apiRequestBuckets = createBuckets(range, now);
  for (const message of receivedMessages) {
    const ts = new Date(message.occurred_at).getTime();
    if (Number.isNaN(ts) || ts < since) continue;
    incrementBucket(receivedBuckets, bucketIndex(ts, range, now));
  }
  for (const log of fromLogs) {
    const ts = new Date(log.at).getTime();
    if (Number.isNaN(ts) || ts < since) continue;
    const index2 = bucketIndex(ts, range, now);
    incrementBucket(sentBuckets, index2);
    if (isApiSend(log)) {
      incrementBucket(apiRequestBuckets, index2);
      if (log.ok) incrementBucket(apiEmailBuckets, index2);
      else incrementBucket(apiErrorBuckets, index2);
    }
  }
  return c.json({
    email,
    displayName: address?.displayName ?? null,
    domain: address?.domain ?? domain,
    range,
    totals: {
      received: sumBuckets(receivedBuckets),
      sent: sumBuckets(sentBuckets),
      apiRequests: sumBuckets(apiRequestBuckets),
      apiEmails: sumBuckets(apiEmailBuckets),
      apiErrors: sumBuckets(apiErrorBuckets)
    },
    series: {
      received: receivedBuckets,
      sent: sentBuckets,
      apiEmails: apiEmailBuckets,
      apiErrors: apiErrorBuckets
    }
  });
});
consoleStats.get("/account-logs", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);
  const status = c.req.query("status")?.trim().toLowerCase() || "all";
  const limit = Math.min(
    Math.max(Number(c.req.query("limit") ?? 50) || 50, 1),
    200
  );
  const domain = domainFromEmail(email);
  const [sendLogs, inboundRows] = await Promise.all([
    listSendLogs(c.env.INBOUND, { limit: 500 }),
    domain ? listInboundRowsForAccount(c, domain, email) : Promise.resolve([])
  ]);
  const rows = [];
  for (const log of sendLogs.logs) {
    if (log.from?.toLowerCase() !== email) continue;
    rows.push({
      id: log.id,
      at: log.at,
      source: isApiSend(log) ? "api" : "dashboard",
      direction: "sent",
      ok: log.ok,
      from: log.from ?? email,
      to: log.to ?? "",
      subject: log.subject ?? "",
      ...log.error ? { error: log.error } : {},
      keyPrefix: log.keyPrefix,
      keyLabel: log.keyLabel,
      status: log.status
    });
  }
  for (const message of inboundRows) {
    rows.push({
      id: message.id,
      at: message.occurred_at,
      source: "inbound",
      direction: "received",
      ok: true,
      from: message.from_email ?? "",
      to: email,
      subject: message.subject ?? "",
      status: null
    });
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  const filtered = status === "failed" ? rows.filter((r) => !r.ok) : status === "success" ? rows.filter((r) => r.ok) : rows;
  const summarySource = filtered;
  const summary = {
    total: summarySource.length,
    success: summarySource.filter((r) => r.ok).length,
    failed: summarySource.filter((r) => !r.ok).length,
    api: summarySource.filter((r) => r.source === "api").length,
    dashboard: summarySource.filter((r) => r.source === "dashboard").length,
    inbound: summarySource.filter((r) => r.source === "inbound").length
  };
  return c.json({
    summary,
    logs: filtered.slice(0, limit),
    workerConnected: true
  });
});

// src/routes/console/broadcasts.ts
init_cloudflare_api_hints();
init_app();
init_catalog_broadcasts();
var consoleBroadcasts = new Hono2();
consoleBroadcasts.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const broadcasts2 = await readBroadcasts(createAppDb(c.env.RELAYBASE_DB));
  const domain = c.req.query("domain")?.trim().toLowerCase();
  const filtered = domain ? broadcasts2.filter((b) => b.domain === domain) : broadcasts2;
  return c.json({ broadcasts: filtered });
});
consoleBroadcasts.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const broadcast = await createBroadcastDraft(createAppDb(c.env.RELAYBASE_DB), {
      id: body.id,
      groupIds: body.groupIds ?? [],
      from: body.from,
      subject: body.subject,
      body: body.body
    });
    return c.json({ broadcast }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleBroadcasts.get("/:broadcastId", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const detail = await getBroadcastDetail(
    createAppDb(c.env.RELAYBASE_DB),
    c.req.param("broadcastId")
  );
  if (!detail) return c.json({ error: "Broadcast not found" }, 404);
  return c.json(detail);
});
consoleBroadcasts.patch("/:broadcastId", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const broadcast = await updateBroadcastDraft2(
      createAppDb(c.env.RELAYBASE_DB),
      c.req.param("broadcastId"),
      body
    );
    return c.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleBroadcasts.post("/:broadcastId/send", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body = {};
  try {
    body = await c.req.json();
  } catch {
  }
  try {
    const broadcast = await sendBroadcast(
      c.env,
      c.req.param("broadcastId"),
      body
    );
    return c.json({ broadcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const body2 = cloudflareSendErrorBody(message);
    return c.json(body2, body2.code ? 403 : 400);
  }
});
consoleBroadcasts.get("/:broadcastId/progress", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const broadcasts2 = await readBroadcasts(createAppDb(c.env.RELAYBASE_DB));
  const broadcast = broadcasts2.find(
    (b) => b.id === c.req.param("broadcastId")
  );
  if (!broadcast) return c.json({ error: "Broadcast not found" }, 404);
  return c.json(getBroadcastProgress(broadcast));
});

// src/routes/console/connect.ts
init_email_send();

// src/lib/r2-usage.ts
var MAX_LIST_PAGES = 20;
async function measureInboundR2Usage(bucket) {
  if (!bucket) return null;
  try {
    let objectCount = 0;
    let totalBytes = 0;
    let cursor;
    let truncated = false;
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      const listed = await bucket.list({ limit: 1e3, cursor });
      for (const object of listed.objects) {
        objectCount += 1;
        totalBytes += object.size;
      }
      if (!listed.truncated) {
        truncated = false;
        break;
      }
      cursor = listed.cursor;
      if (page === MAX_LIST_PAGES - 1) truncated = true;
    }
    return { objectCount, totalBytes, truncated };
  } catch (error) {
    console.error("Mailbox R2 usage failed", error);
    return null;
  }
}
__name(measureInboundR2Usage, "measureInboundR2Usage");

// src/routes/console/connect.ts
var CF_API = "https://api.cloudflare.com/client/v4";
async function probeCfApiTokenValid(token) {
  try {
    const res = await fetch(`${CF_API}/zones?per_page=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
__name(probeCfApiTokenValid, "probeCfApiTokenValid");
var consoleConnect = new Hono2();
async function checkInboundR2(bucket) {
  try {
    await bucket.list({ limit: 1 });
    return true;
  } catch (error) {
    console.error("Inbound R2 check failed", error);
    return false;
  }
}
__name(checkInboundR2, "checkInboundR2");
consoleConnect.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const r2Configured = await checkInboundR2(c.env.INBOUND);
  const apiToken = c.env.CF_API_TOKEN?.trim() ?? "";
  const cfApiTokenSet = Boolean(apiToken);
  const [usage, d1, cfApiTokenValid] = await Promise.all([
    r2Configured ? measureInboundR2Usage(c.env.INBOUND) : Promise.resolve(null),
    probeD1Connection(
      c.env.RELAYBASE_LOGS,
      c.env.RELAYBASE_MAIL,
      c.env.RELAYBASE_DB,
      c.env.CF_ACCOUNT_ID,
      c.env.CF_API_TOKEN
    ),
    cfApiTokenSet ? probeCfApiTokenValid(apiToken) : Promise.resolve(false)
  ]);
  return c.json({
    ok: true,
    product: "relaybase",
    version: c.env.WORKER_VERSION?.trim() || "unknown",
    workerScriptName: c.env.WORKER_SCRIPT_NAME || "relaybase-api",
    // CF account id (from the CF_ACCOUNT_ID secret). Surfaced so the desktop
    // can display/manage the server token without a separate OAuth connection
    // or manual entry.
    accountId: c.env.CF_ACCOUNT_ID?.trim() || "",
    inbound: {
      r2Configured,
      bucketName: c.env.INBOUND_BUCKET_NAME || "relaybase-mailbox",
      usage
    },
    d1,
    // Worker has a CF_API_TOKEN secret (domain / routing / DNS API).
    cfApiTokenSet,
    // Secret is present and Cloudflare accepted a Zone Read probe.
    cfApiTokenValid,
    emailBindingConfigured: emailBindingConfigured(c.env)
  });
});

// src/routes/console/init-db.ts
init_app();

// db/migrations.ts
var APP_0000 = `CREATE TABLE \`domains\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`domain\` text NOT NULL,
	\`created_at\` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`domains_domain_unique\` ON \`domains\` (\`domain\`);
--> statement-breakpoint
CREATE TABLE \`addresses\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`email\` text NOT NULL,
	\`domain\` text NOT NULL,
	\`display_name\` text,
	\`signature\` text,
	\`inbound_enabled\` integer DEFAULT 1 NOT NULL,
	\`mobile_enabled\` integer DEFAULT 1 NOT NULL,
	\`created_at\` text NOT NULL,
	FOREIGN KEY (\`domain\`) REFERENCES \`domains\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`addresses_email_unique\` ON \`addresses\` (\`email\`);
--> statement-breakpoint
CREATE INDEX \`addresses_domain_idx\` ON \`addresses\` (\`domain\`);
--> statement-breakpoint
CREATE TABLE \`api_keys\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`key_hash\` text NOT NULL,
	\`domain\` text NOT NULL,
	\`label\` text,
	\`key_prefix\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`active\` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`api_keys_key_hash_unique\` ON \`api_keys\` (\`key_hash\`);
--> statement-breakpoint
CREATE INDEX \`api_keys_domain_idx\` ON \`api_keys\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`api_keys_active_idx\` ON \`api_keys\` (\`active\`);
--> statement-breakpoint
CREATE TABLE \`audience_groups\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`domain\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`default_from\` text,
	\`data_source_json\` text,
	\`cron_enabled\` integer DEFAULT 0 NOT NULL,
	\`cron_interval_minutes\` integer,
	\`last_sync_at\` text,
	\`last_sync_status\` text,
	\`last_sync_error\` text,
	\`last_sync_count\` integer,
	\`sync_progress_json\` text,
	\`sync_history_json\` text
);
--> statement-breakpoint
CREATE INDEX \`audience_groups_domain_idx\` ON \`audience_groups\` (\`domain\`);
--> statement-breakpoint
CREATE TABLE \`audience_contacts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`email\` text NOT NULL,
	\`name\` text,
	\`domain\` text NOT NULL,
	\`group_id\` text NOT NULL,
	\`source\` text NOT NULL,
	\`added_at\` text NOT NULL,
	FOREIGN KEY (\`group_id\`) REFERENCES \`audience_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`audience_contacts_group_email_idx\` ON \`audience_contacts\` (\`group_id\`,\`email\`);
--> statement-breakpoint
CREATE INDEX \`audience_contacts_group_idx\` ON \`audience_contacts\` (\`group_id\`);
--> statement-breakpoint
CREATE INDEX \`audience_contacts_domain_idx\` ON \`audience_contacts\` (\`domain\`);
--> statement-breakpoint
CREATE TABLE \`auth_tokens\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`token_hash\` text NOT NULL,
	\`label\` text,
	\`product_id\` text,
	\`token_prefix\` text NOT NULL,
	\`created_at\` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`auth_tokens_token_hash_unique\` ON \`auth_tokens\` (\`token_hash\`);
--> statement-breakpoint
CREATE TABLE \`broadcasts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`subject\` text NOT NULL,
	\`status\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`domain\` text NOT NULL,
	\`group_ids_json\` text NOT NULL,
	\`from_addr\` text,
	\`body\` text,
	\`recipient_count\` integer,
	\`sent_at\` text,
	\`send_progress_json\` text,
	\`send_history_json\` text
);
--> statement-breakpoint
CREATE INDEX \`broadcasts_domain_idx\` ON \`broadcasts\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`broadcasts_status_idx\` ON \`broadcasts\` (\`status\`);
--> statement-breakpoint
CREATE INDEX \`broadcasts_created_at_idx\` ON \`broadcasts\` (\`created_at\`);
--> statement-breakpoint
CREATE TABLE \`domain_branding\` (
	\`domain\` text PRIMARY KEY NOT NULL,
	\`dmarc_policy\` text DEFAULT 'quarantine' NOT NULL,
	\`dmarc_rua\` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`inbound_events\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`domain\` text NOT NULL,
	\`event_type\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`payload_json\` text NOT NULL,
	\`expires_at\` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`inbound_events_domain_idx\` ON \`inbound_events\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`inbound_events_expires_idx\` ON \`inbound_events\` (\`expires_at\`);
--> statement-breakpoint
CREATE TABLE \`mobile_passwords\` (
	\`email\` text PRIMARY KEY NOT NULL,
	\`password_hash\` text NOT NULL,
	\`salt\` text NOT NULL,
	\`updated_at\` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`owner_config\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`owner_email\` text,
	\`worker_url\` text
);
--> statement-breakpoint
CREATE TABLE \`webhooks\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`domain\` text NOT NULL,
	\`url\` text NOT NULL,
	\`secret_hash\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`active\` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`webhooks_domain_idx\` ON \`webhooks\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`webhooks_active_idx\` ON \`webhooks\` (\`active\`);
--> statement-breakpoint
CREATE TABLE \`webhook_fails\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`webhook_id\` text NOT NULL,
	\`event_id\` text NOT NULL,
	\`url\` text NOT NULL,
	\`failed_at\` text NOT NULL,
	\`expires_at\` text NOT NULL,
	FOREIGN KEY (\`webhook_id\`) REFERENCES \`webhooks\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`webhook_fails_webhook_idx\` ON \`webhook_fails\` (\`webhook_id\`);
--> statement-breakpoint
CREATE INDEX \`webhook_fails_expires_idx\` ON \`webhook_fails\` (\`expires_at\`);
--> statement-breakpoint
CREATE TABLE \`webhook_secrets\` (
	\`webhook_id\` text PRIMARY KEY NOT NULL,
	\`secret\` text NOT NULL,
	FOREIGN KEY (\`webhook_id\`) REFERENCES \`webhooks\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`;
var APP_0001 = `ALTER TABLE \`owner_config\` ADD \`admin_token\` text;`;
var APP_0002 = `CREATE TABLE \`app_settings\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`inbound_retain_per_domain\` integer,
	\`updated_at\` text NOT NULL
);`;
var APP_0003 = `ALTER TABLE \`owner_config\` DROP COLUMN \`admin_token\`;
--> statement-breakpoint
ALTER TABLE \`owner_config\` ADD \`admin_username\` text;
--> statement-breakpoint
ALTER TABLE \`owner_config\` ADD \`passtoken_salt\` text;
--> statement-breakpoint
ALTER TABLE \`owner_config\` ADD \`passtoken_hash\` text;
--> statement-breakpoint
ALTER TABLE \`owner_config\` ADD \`passtoken_prefix\` text;
--> statement-breakpoint
ALTER TABLE \`owner_config\` ADD \`passtoken_updated_at\` text;
--> statement-breakpoint
CREATE TABLE \`owner_sessions\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`token_hash\` text NOT NULL,
	\`family\` text NOT NULL,
	\`label\` text,
	\`created_at\` text NOT NULL,
	\`expires_at\` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`owner_sessions_token_hash_unique\` ON \`owner_sessions\` (\`token_hash\`);
--> statement-breakpoint
CREATE INDEX \`owner_sessions_family_idx\` ON \`owner_sessions\` (\`family\`);
--> statement-breakpoint
DROP TABLE IF EXISTS \`auth_tokens\`;`;
var APP_0004 = `ALTER TABLE \`owner_config\` DROP COLUMN \`admin_username\`;`;
var APP_0005 = `ALTER TABLE \`owner_config\` DROP COLUMN \`failed_attempts\`;
--> statement-breakpoint
ALTER TABLE \`owner_config\` DROP COLUMN \`locked_until\`;`;
var LOGS_0001 = `CREATE TABLE IF NOT EXISTS ops_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  ok INTEGER NOT NULL,
  status INTEGER,
  source TEXT,
  domain TEXT,
  from_addr TEXT,
  to_addr TEXT,
  subject TEXT,
  message_id TEXT,
  error TEXT,
  key_id TEXT,
  key_prefix TEXT,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS ops_log_at_idx ON ops_log (at DESC);
CREATE INDEX IF NOT EXISTS ops_log_ok_idx ON ops_log (ok, at DESC);
CREATE INDEX IF NOT EXISTS ops_log_domain_idx ON ops_log (domain);
CREATE INDEX IF NOT EXISTS ops_log_kind_idx ON ops_log (kind, at DESC);`;
var MAIL_0001 = `CREATE TABLE IF NOT EXISTS mailbox_messages (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  domain TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  to_emails TEXT,
  cc_emails TEXT,
  recipients TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  refs TEXT,
  size INTEGER NOT NULL,
  attachment_count INTEGER NOT NULL,
  read_at TEXT,
  r2_prefix TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS mailbox_rfc_idx
  ON mailbox_messages (domain, kind, message_id)
  WHERE message_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mailbox_list_idx
  ON mailbox_messages (kind, domain, occurred_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mailbox_unread_idx
  ON mailbox_messages (kind, domain, read_at)
  WHERE kind = 'inbound' AND read_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mailbox_domain_idx
  ON mailbox_messages (domain, kind);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS mailbox_fts USING fts5(
  id UNINDEXED,
  kind UNINDEXED,
  domain UNINDEXED,
  subject,
  from_email,
  from_name,
  to_emails,
  cc_emails,
  body_text
);`;
var MIGRATIONS = [
  { target: "app", name: "0000_old_pandemic", sql: APP_0000 },
  { target: "app", name: "0001_owner_admin_token", sql: APP_0001 },
  { target: "app", name: "0002_app_settings", sql: APP_0002 },
  { target: "app", name: "0003_owner_login", sql: APP_0003 },
  { target: "app", name: "0004_drop_admin_username", sql: APP_0004 },
  { target: "app", name: "0005_drop_login_lockout", sql: APP_0005 },
  { target: "logs", name: "0001_ops_logs", sql: LOGS_0001 },
  { target: "mail", name: "0001_create_mailbox", sql: MAIL_0001 }
];
function splitMigrationSql(sql4) {
  return sql4.split("--> statement-breakpoint").map((part) => part.trim()).filter((part) => part.length > 0 && !isCommentOnly(part));
}
__name(splitMigrationSql, "splitMigrationSql");
function isCommentOnly(sql4) {
  return sql4.split("\n").every((line) => line.trim() === "" || line.trim().startsWith("--"));
}
__name(isCommentOnly, "isCommentOnly");

// src/lib/d1-migration-names.ts
function normalizeMigrationName(name) {
  return name.trim().replace(/\.sql$/i, "");
}
__name(normalizeMigrationName, "normalizeMigrationName");
function d1ErrorText(error) {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? error.cause.message : error.cause != null ? String(error.cause) : "";
    return [error.message, cause, error.toString()].filter(Boolean).join(" ");
  }
  if (error && typeof error === "object") {
    const o = error;
    return [o.message, o.error, o.cause, JSON.stringify(error)].filter((v) => v != null && String(v).length > 0).join(" ");
  }
  return String(error);
}
__name(d1ErrorText, "d1ErrorText");
function isSchemaAlreadyPresentError(message) {
  const lower = message.toLowerCase();
  return lower.includes("already exists") || lower.includes("duplicate column");
}
__name(isSchemaAlreadyPresentError, "isSchemaAlreadyPresentError");

// src/lib/d1-migrations.ts
var MIGRATIONS_TABLE = "d1_migrations";
var PROBE_TABLES = {
  app: "domains",
  logs: "ops_log",
  mail: "mailbox_messages"
};
var MIGRATION_TARGETS = ["app", "logs", "mail"];
var BINDING_MAP = {
  app: "RELAYBASE_DB",
  logs: "RELAYBASE_LOGS",
  mail: "RELAYBASE_MAIL"
};
async function tableExists(db, tableName) {
  try {
    const row = await db.prepare(
      `SELECT 1 AS ok FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? LIMIT 1`
    ).bind(tableName).first();
    if (row) return true;
  } catch {
  }
  try {
    await db.prepare(`SELECT 1 AS ok FROM "${tableName}" LIMIT 1`).first();
    return true;
  } catch {
    return false;
  }
}
__name(tableExists, "tableExists");
function bindingFor(target) {
  return BINDING_MAP[target];
}
__name(bindingFor, "bindingFor");
function dbFor(env, target) {
  return env[bindingFor(target)];
}
__name(dbFor, "dbFor");
async function anyProbeTableExists(env) {
  const results = [];
  for (const target of MIGRATION_TARGETS) {
    const binding = bindingFor(target);
    const db = dbFor(env, target);
    if (!db) {
      results.push({ target, binding, present: false });
      continue;
    }
    results.push({
      target,
      binding,
      present: await tableExists(db, PROBE_TABLES[target])
    });
  }
  return {
    alreadyInitialized: results.some((r) => r.present),
    results
  };
}
__name(anyProbeTableExists, "anyProbeTableExists");
async function listAppliedMigrations(db) {
  try {
    const rows = await db.prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`).all();
    return new Set(
      (rows.results ?? []).map((r) => normalizeMigrationName(r.name)).filter((n) => n.length > 0)
    );
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
__name(listAppliedMigrations, "listAppliedMigrations");
async function stampMigration(db, name) {
  await db.prepare(
    `INSERT OR IGNORE INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`
  ).bind(normalizeMigrationName(name)).run();
}
__name(stampMigration, "stampMigration");
async function applyPendingForTarget(env, target) {
  const binding = bindingFor(target);
  const db = dbFor(env, target);
  if (!db) {
    return {
      target,
      binding,
      configured: false,
      alreadyInitialized: false,
      applied: [],
      skipped: [],
      error: `D1 binding ${binding} is not configured`
    };
  }
  try {
    const alreadyInitialized = await tableExists(db, PROBE_TABLES[target]);
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`
    ).run();
    const appliedSet = await listAppliedMigrations(db);
    const targetMigrations = MIGRATIONS.filter((m) => m.target === target);
    const applied = [];
    const skipped = [];
    for (const [index2, migration] of targetMigrations.entries()) {
      const name = normalizeMigrationName(migration.name);
      if (appliedSet.has(name)) {
        skipped.push(name);
        continue;
      }
      const isBaseline = index2 === 0;
      if (alreadyInitialized && isBaseline) {
        await stampMigration(db, name);
        appliedSet.add(name);
        skipped.push(name);
        continue;
      }
      try {
        const statements = splitMigrationSql(migration.sql);
        for (const stmt of statements) {
          try {
            const result = await db.prepare(stmt).run();
            const resultError = result && typeof result === "object" && "error" in result && result.error ? String(result.error) : "";
            if (resultError && !isSchemaAlreadyPresentError(resultError)) {
              throw new Error(resultError);
            }
          } catch (error) {
            const message = d1ErrorText(error);
            if (!isSchemaAlreadyPresentError(message)) {
              throw error;
            }
          }
        }
        await stampMigration(db, name);
        appliedSet.add(name);
        applied.push(name);
      } catch (error) {
        const message = d1ErrorText(error);
        if (isSchemaAlreadyPresentError(message)) {
          await stampMigration(db, name);
          appliedSet.add(name);
          skipped.push(name);
          continue;
        }
        throw error;
      }
    }
    return {
      target,
      binding,
      configured: true,
      alreadyInitialized,
      applied,
      skipped
    };
  } catch (error) {
    const message = d1ErrorText(error);
    return {
      target,
      binding,
      configured: true,
      alreadyInitialized: false,
      applied: [],
      skipped: [],
      error: message
    };
  }
}
__name(applyPendingForTarget, "applyPendingForTarget");
async function applyPendingMigrations(env) {
  const results = [];
  for (const target of MIGRATION_TARGETS) {
    results.push(await applyPendingForTarget(env, target));
  }
  return {
    alreadyInitialized: results.some((r) => r.alreadyInitialized),
    applied: results.flatMap((r) => r.applied),
    skipped: results.flatMap((r) => r.skipped),
    results,
    errors: results.filter((r) => r.error).map((r) => `${r.binding}: ${r.error}`)
  };
}
__name(applyPendingMigrations, "applyPendingMigrations");

// src/routes/console/init-db.ts
var consoleInitDb = new Hono2();
consoleInitDb.post("/", async (c) => {
  const db = createAppDb(c.env.RELAYBASE_DB);
  const hasOwner = db ? await ownerIsConfigured(db) : false;
  const denied = await requireSchemaAuth(c, hasOwner);
  if (denied) return denied;
  const probe = await anyProbeTableExists(c.env);
  if (probe.alreadyInitialized) {
    return c.json(
      {
        ok: false,
        error: "DB_ALREADY_INITIALIZED",
        alreadyInitialized: true,
        applied: [],
        skipped: [],
        results: probe.results
      },
      409
    );
  }
  const applied = await applyPendingMigrations(c.env);
  if (applied.errors.length > 0) {
    return c.json(
      {
        ok: false,
        alreadyInitialized: false,
        applied: applied.applied,
        skipped: applied.skipped,
        results: applied.results,
        error: applied.errors.join("; ")
      },
      500
    );
  }
  return c.json({
    ok: true,
    alreadyInitialized: false,
    applied: applied.applied,
    skipped: applied.skipped,
    results: applied.results
  });
});

// src/routes/console/migrate-db.ts
init_app();
var consoleMigrateDb = new Hono2();
consoleMigrateDb.post("/", async (c) => {
  const db = createAppDb(c.env.RELAYBASE_DB);
  const hasOwner = db ? await ownerIsConfigured(db) : false;
  const denied = await requireSchemaAuth(c, hasOwner);
  if (denied) return denied;
  const applied = await applyPendingMigrations(c.env);
  if (applied.errors.length > 0) {
    return c.json(
      {
        ok: false,
        alreadyInitialized: applied.alreadyInitialized,
        applied: applied.applied,
        skipped: applied.skipped,
        results: applied.results,
        error: applied.errors.join("; ")
      },
      500
    );
  }
  return c.json({
    ok: true,
    alreadyInitialized: applied.alreadyInitialized,
    applied: applied.applied,
    skipped: applied.skipped,
    results: applied.results
  });
});

// src/routes/console/mailbox.ts
init_cloudflare_config();
init_app();

// src/lib/inbound-routing.ts
init_cloudflare_client();
function describeRule(rule) {
  const literal = rule.matchers.find(
    (matcher) => matcher.type === "literal" && matcher.field === "to"
  );
  const action = rule.actions[0];
  const actionType = action?.type ?? "unknown";
  return {
    ruleId: rule.id,
    enabled: rule.enabled,
    address: literal?.value?.trim().toLowerCase() ?? null,
    matcherType: literal ? "literal" : rule.matchers[0]?.type ?? "unknown",
    action: actionType,
    worker: actionType === "worker" && Array.isArray(action?.value) ? action.value[0] ?? null : null
  };
}
__name(describeRule, "describeRule");
async function listInboundRouting(cf, domain) {
  const zoneId = await resolveZoneId(cf, domain);
  const [routing, existing] = await Promise.all([
    cf.getEmailRoutingSettings(zoneId),
    cf.listEmailRoutingRules(zoneId)
  ]);
  return {
    domain,
    zoneId,
    routingEnabled: routing.enabled,
    rules: existing.map(describeRule)
  };
}
__name(listInboundRouting, "listInboundRouting");
async function resolveZoneId(cf, domain) {
  const zoneId = await cf.resolveZoneId(domain);
  if (!zoneId) {
    throw new Error(
      `Could not resolve Cloudflare zone for ${domain} \u2014 ensure the domain is on this account`
    );
  }
  return zoneId;
}
__name(resolveZoneId, "resolveZoneId");
function matchesAddress(rule, address) {
  return rule.matchers.some(
    (matcher) => matcher.type === "literal" && matcher.field === "to" && matcher.value?.toLowerCase() === address.toLowerCase()
  );
}
__name(matchesAddress, "matchesAddress");
var MX_CONFLICT_ERROR_CODE = 2008;
function isMxConflictError(error) {
  return error instanceof Error && error.message.includes(`[${MX_CONFLICT_ERROR_CODE}]`);
}
__name(isMxConflictError, "isMxConflictError");
function isCloudflareMxContent(content) {
  return content.trim().toLowerCase().endsWith("mx.cloudflare.net");
}
__name(isCloudflareMxContent, "isCloudflareMxContent");
async function findConflictingMxRecords(cf, zoneId, domain) {
  const apexNames = /* @__PURE__ */ new Set([domain.toLowerCase(), "@"]);
  const mxRecords = await cf.listDnsRecords(zoneId, { type: "MX" });
  return mxRecords.filter(
    (record) => apexNames.has(record.name.toLowerCase()) && !isCloudflareMxContent(record.content)
  ).map((record) => ({
    id: record.id,
    name: record.name,
    content: record.content,
    priority: record.priority
  }));
}
__name(findConflictingMxRecords, "findConflictingMxRecords");
async function clearConflictingMxRecords(cf, zoneId, domain) {
  const conflicts = await findConflictingMxRecords(cf, zoneId, domain);
  for (const record of conflicts) {
    await cf.deleteDnsRecord(zoneId, record.id);
  }
  return { removed: conflicts };
}
__name(clearConflictingMxRecords, "clearConflictingMxRecords");
var MxConflictError = class extends Error {
  static {
    __name(this, "MxConflictError");
  }
  domain;
  zoneId;
  mxConflicts;
  constructor(domain, zoneId, mxConflicts) {
    super(
      `Non-Cloudflare MX records exist for ${domain}. Remove them (or approve removal) to enable Email Routing.`
    );
    this.name = "MxConflictError";
    this.domain = domain;
    this.zoneId = zoneId;
    this.mxConflicts = mxConflicts;
  }
};
async function ensureInboundRouting(cf, domain, entries, workerScriptName, opts = {}) {
  const zoneId = await resolveZoneId(cf, domain);
  const routing = await cf.getEmailRoutingSettings(zoneId);
  if (!routing.enabled) {
    try {
      await cf.enableEmailRouting(zoneId);
    } catch (error) {
      if (!isMxConflictError(error)) throw error;
      if (opts.forceMxResolve) {
        await clearConflictingMxRecords(cf, zoneId, domain);
        await cf.enableEmailRouting(zoneId);
      } else {
        const mxConflicts = await findConflictingMxRecords(cf, zoneId, domain);
        throw new MxConflictError(domain, zoneId, mxConflicts);
      }
    }
  }
  const existing = await cf.listEmailRoutingRules(zoneId);
  const rules = [];
  for (const entry of entries) {
    const address = entry.address.trim().toLowerCase();
    if (!address) continue;
    const receive = entry.inboundEnabled !== false;
    const action = receive ? { type: "worker", value: [workerScriptName] } : { type: "drop" };
    const ruleAction = receive ? "worker" : "drop";
    const ruleName = receive ? `Store ${address} in Worker` : `Drop inbound for ${address}`;
    const current = existing.find((rule) => matchesAddress(rule, address));
    if (current) {
      const updated = await cf.updateEmailRoutingRule(zoneId, current.id, {
        enabled: true,
        actions: [action],
        matchers: [{ type: "literal", field: "to", value: address }]
      });
      rules.push({
        address,
        ruleId: updated.id,
        action: ruleAction
      });
      continue;
    }
    const created = await cf.createEmailRoutingRule(zoneId, {
      name: ruleName,
      enabled: true,
      priority: 0,
      matchers: [{ type: "literal", field: "to", value: address }],
      actions: [action]
    });
    rules.push({
      address,
      ruleId: created.id,
      action: ruleAction
    });
  }
  return {
    domain,
    zoneId,
    routingEnabled: true,
    rules
  };
}
__name(ensureInboundRouting, "ensureInboundRouting");
async function removeInboundWorkerRouting(cf, domain, addresses2) {
  const zoneId = await resolveZoneId(cf, domain);
  const existing = await cf.listEmailRoutingRules(zoneId);
  const targets = new Set(
    addresses2.map((address) => address.trim().toLowerCase()).filter(Boolean)
  );
  const removed = [];
  for (const address of targets) {
    const matches = existing.filter((rule) => matchesAddress(rule, address));
    for (const rule of matches) {
      await cf.deleteEmailRoutingRule(zoneId, rule.id);
      removed.push({ address, ruleId: rule.id });
    }
  }
  return { domain, zoneId, removed };
}
__name(removeInboundWorkerRouting, "removeInboundWorkerRouting");

// src/routes/console/mailbox.ts
init_catalog_store();

// db/app/mobile.ts
init_drizzle_orm();
init_schema();
async function getAccountMobileConfig(db, email) {
  if (!db) return null;
  const row = await db.select().from(mobilePasswords).where(eq(mobilePasswords.email, email.trim().toLowerCase())).get();
  if (!row) return null;
  return {
    passwordHash: row.passwordHash,
    salt: row.salt,
    updatedAt: row.updatedAt
  };
}
__name(getAccountMobileConfig, "getAccountMobileConfig");
async function setAccountMobileConfig(db, email, config) {
  if (!db) return;
  await db.insert(mobilePasswords).values({
    email: email.trim().toLowerCase(),
    passwordHash: config.passwordHash,
    salt: config.salt,
    updatedAt: config.updatedAt
  }).onConflictDoUpdate({
    target: mobilePasswords.email,
    set: {
      passwordHash: config.passwordHash,
      salt: config.salt,
      updatedAt: config.updatedAt
    }
  }).run();
}
__name(setAccountMobileConfig, "setAccountMobileConfig");
async function clearAccountMobileConfig(db, email) {
  if (!db) return;
  await db.delete(mobilePasswords).where(eq(mobilePasswords.email, email.trim().toLowerCase())).run();
}
__name(clearAccountMobileConfig, "clearAccountMobileConfig");

// src/lib/mobile-config.ts
function bytesToHex3(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex3, "bytesToHex");
function randomHex(byteLength) {
  return bytesToHex3(crypto.getRandomValues(new Uint8Array(byteLength)));
}
__name(randomHex, "randomHex");
var PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function generateMobilePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}
__name(generateMobilePassword, "generateMobilePassword");
function generateMobileSalt() {
  return randomHex(16);
}
__name(generateMobileSalt, "generateMobileSalt");
async function hashMobilePassword(password, salt) {
  return sha256Hex(`${salt}:${password.trim()}`);
}
__name(hashMobilePassword, "hashMobilePassword");
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
__name(constantTimeEqual, "constantTimeEqual");
async function getAccountMobileConfig2(db, email) {
  return getAccountMobileConfig(db, email);
}
__name(getAccountMobileConfig2, "getAccountMobileConfig");
async function setAccountMobileConfig2(db, email, config) {
  await setAccountMobileConfig(db, email, config);
}
__name(setAccountMobileConfig2, "setAccountMobileConfig");
async function clearAccountMobileConfig2(db, email) {
  await clearAccountMobileConfig(db, email);
}
__name(clearAccountMobileConfig2, "clearAccountMobileConfig");
async function rotateAccountMobileConfig(db, email) {
  const password = generateMobilePassword();
  const salt = generateMobileSalt();
  const passwordHash = await hashMobilePassword(password, salt);
  const config = {
    passwordHash,
    salt,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await setAccountMobileConfig2(db, email, config);
  return { password, config };
}
__name(rotateAccountMobileConfig, "rotateAccountMobileConfig");
function toAccountMobileConfigPublicView(config) {
  return config ? { hasPassword: true, updatedAt: config.updatedAt } : { hasPassword: false, updatedAt: null };
}
__name(toAccountMobileConfigPublicView, "toAccountMobileConfigPublicView");

// src/routes/console/mailbox.ts
var consoleMailbox = new Hono2();
consoleMailbox.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const data = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  return c.json(data);
});
consoleMailbox.put("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domains2 = Array.isArray(body.domains) ? [
    ...new Set(
      body.domains.filter((d) => typeof d === "string").map(normalizeDomain2).filter(Boolean)
    )
  ].sort() : [];
  const addresses2 = Array.isArray(body.addresses) ? body.addresses.filter(
    (a) => !!a && typeof a === "object" && typeof a.email === "string" && typeof a.domain === "string"
  ).map(
    (a) => normalizeMailboxAddress({
      email: a.email,
      domain: a.domain,
      displayName: typeof a.displayName === "string" ? a.displayName : void 0,
      inboundEnabled: a.inboundEnabled === false ? false : a.inboundEnabled === true ? true : void 0
    })
  ) : [];
  const data = { domains: domains2, addresses: addresses2 };
  await writeMailbox(createAppDb(c.env.RELAYBASE_DB), data);
  return c.json(data);
});
consoleMailbox.get("/config", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const data = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  const domains2 = data.domains;
  const emailDomain = domains2[0] ?? "";
  return c.json({
    emailDomain,
    domain: emailDomain,
    domains: domains2,
    activeDomain: emailDomain || null,
    registeredAddresses: data.addresses.map((a) => a.email),
    configured: domains2.length > 0,
    relaybaseConfigured: true,
    relaybaseAuthConfigured: true,
    cloudflareConfigured: true,
    credentialSource: "integration",
    usesIntegrationCredentials: true,
    audienceContacts: [],
    broadcasts: [],
    relaybaseWorkerUrl: ""
  });
});
var consoleDomains = new Hono2();
consoleDomains.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const data = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  return c.json({ domains: listDomainSummaries(data) });
});
consoleDomains.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const data = await addDomain2(createAppDb(c.env.RELAYBASE_DB), body.domain ?? "");
    const domain = normalizeDomain2(body.domain ?? "");
    const summaries = listDomainSummaries(data);
    return c.json({
      domains: summaries,
      onboarding: summaries.find((d) => d.domain === domain)?.onboarding ?? null,
      message: `Added ${domain}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return c.json({ error: message }, 400);
  }
});
consoleDomains.delete("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  const data = await removeDomain2(createAppDb(c.env.RELAYBASE_DB), domain);
  return c.json({
    domains: listDomainSummaries(data),
    message: "Domain removed"
  });
});
var consoleAddresses = new Hono2();
consoleAddresses.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const data = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  if (c.req.query("all") === "1") {
    return c.json({ addresses: data.addresses });
  }
  const domain = normalizeDomain2(c.req.query("domain") ?? "");
  if (!domain) {
    return c.json({ error: "domain query required" }, 400);
  }
  if (!data.domains.includes(domain)) {
    return c.json({ error: "Domain not found" }, 404);
  }
  return c.json({
    addresses: data.addresses.filter((a) => a.domain === domain)
  });
});
consoleAddresses.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = normalizeDomain2(
    body.domain ?? c.req.query("domain") ?? ""
  );
  if (!domain) {
    return c.json(
      { error: "Select a domain before adding senders" },
      400
    );
  }
  const localParts = (Array.isArray(body.localParts) && body.localParts.length ? body.localParts : body.localPart ? [body.localPart] : []).map((part) => part.trim()).filter(Boolean);
  if (!localParts.length) {
    return c.json(
      { error: "localPart or localParts is required" },
      400
    );
  }
  const emails = [
    ...new Set(localParts.map((part) => `${part}@${domain}`.toLowerCase()))
  ];
  const inboundByLocal = body.inboundEnabledByLocalPart && typeof body.inboundEnabledByLocalPart === "object" ? body.inboundEnabledByLocalPart : {};
  const singleDisplayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const displayNames = body.displayNames && typeof body.displayNames === "object" ? body.displayNames : {};
  const entries = emails.map((email) => {
    const local = email.split("@")[0] ?? "";
    const fromMap = typeof displayNames[local] === "string" ? displayNames[local].trim() : "";
    const inboundFromMap = typeof inboundByLocal[local] === "boolean" ? inboundByLocal[local] : typeof inboundByLocal[local.toLowerCase()] === "boolean" ? inboundByLocal[local.toLowerCase()] : void 0;
    const inboundEnabled = typeof inboundFromMap === "boolean" ? inboundFromMap : typeof body.inboundEnabled === "boolean" ? body.inboundEnabled : true;
    return {
      email,
      displayName: fromMap || singleDisplayName || void 0,
      inboundEnabled
    };
  });
  try {
    const cf = await createCloudflareClient(c.env);
    await ensureInboundRouting(
      cf,
      domain,
      entries.map((entry) => ({
        address: entry.email,
        inboundEnabled: entry.inboundEnabled
      })),
      c.env.WORKER_SCRIPT_NAME,
      { forceMxResolve: body.forceMxResolve === true }
    );
  } catch (error) {
    if (error instanceof MxConflictError) {
      return c.json(
        {
          error: "Non-Cloudflare MX records exist for this domain. Remove them to enable Email Routing.",
          mxConflict: true,
          domain: error.domain,
          mxConflicts: error.mxConflicts
        },
        409
      );
    }
    const message = error instanceof Error ? error.message : "Failed to configure inbound routing";
    return c.json(
      {
        error: `Could not configure inbox for ${emails.join(", ")}: ${message}`
      },
      502
    );
  }
  const { data, added } = await upsertAddresses2(createAppDb(c.env.RELAYBASE_DB), domain, entries);
  if (added.length === 1) {
    return c.json({ address: added[0], addresses: added });
  }
  return c.json({
    addresses: added,
    all: data.addresses.filter((a) => a.domain === domain)
  });
});
consoleAddresses.patch("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }
  const data = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  const index2 = data.addresses.findIndex((a) => a.email === email);
  if (index2 < 0) {
    return c.json({ error: "Address not found" }, 404);
  }
  const current = data.addresses[index2];
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : body.displayName === null ? "" : void 0;
  const signature = typeof body.signature === "string" ? body.signature : body.signature === null ? "" : void 0;
  const inboundEnabled = typeof body.inboundEnabled === "boolean" ? body.inboundEnabled : current.inboundEnabled !== false;
  const mobileEnabled = typeof body.mobileEnabled === "boolean" ? body.mobileEnabled : current.mobileEnabled !== false;
  if (displayName === void 0 && signature === void 0 && typeof body.inboundEnabled !== "boolean" && typeof body.mobileEnabled !== "boolean") {
    return c.json({ address: current });
  }
  if (typeof body.inboundEnabled === "boolean") {
    try {
      const cf = await createCloudflareClient(c.env);
      await ensureInboundRouting(
        cf,
        current.domain,
        [{ address: email, inboundEnabled }],
        c.env.WORKER_SCRIPT_NAME
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update inbound routing";
      return c.json({ error: message }, 502);
    }
  }
  const updated = await updateAddress2(createAppDb(c.env.RELAYBASE_DB), email, {
    displayName,
    signature,
    inboundEnabled,
    mobileEnabled
  });
  if (!updated) {
    return c.json({ error: "Address not found" }, 404);
  }
  return c.json({ address: updated });
});
consoleAddresses.delete("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }
  const { data, removed } = await removeAddress2(createAppDb(c.env.RELAYBASE_DB), email);
  if (removed) {
    try {
      const cf = await createCloudflareClient(c.env);
      await removeInboundWorkerRouting(cf, removed.domain, [removed.email]);
    } catch (error) {
      console.error("Failed to remove inbound routing", error);
    }
  }
  const domain = c.req.query("domain")?.trim().toLowerCase();
  return c.json({
    addresses: domain ? data.addresses.filter((a) => a.domain === domain) : data.addresses
  });
});
consoleAddresses.get("/mobile-password", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }
  const config = await getAccountMobileConfig2(createAppDb(c.env.RELAYBASE_DB), email);
  return c.json(toAccountMobileConfigPublicView(config));
});
consoleAddresses.post("/mobile-password", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }
  const { password, config } = await rotateAccountMobileConfig(
    createAppDb(c.env.RELAYBASE_DB),
    email
  );
  return c.json({
    password,
    hasPassword: true,
    updatedAt: config.updatedAt
  });
});
consoleAddresses.delete("/mobile-password", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }
  await clearAccountMobileConfig2(createAppDb(c.env.RELAYBASE_DB), email);
  return c.json({ hasPassword: false, updatedAt: null });
});

// src/routes/console/branding.ts
init_cloudflare_config();
init_app();

// db/app/branding.ts
init_drizzle_orm();
init_schema();
function defaultBrandingForDomain(domain) {
  return {
    dmarcPolicy: "quarantine",
    dmarcRua: `dmarc@${domain}`
  };
}
__name(defaultBrandingForDomain, "defaultBrandingForDomain");
async function getDomainBranding(db, domain) {
  if (!db) return defaultBrandingForDomain(domain);
  const row = await db.select().from(domainBranding).where(eq(domainBranding.domain, domain.toLowerCase())).get();
  if (!row) return defaultBrandingForDomain(domain);
  return {
    dmarcPolicy: row.dmarcPolicy,
    dmarcRua: row.dmarcRua
  };
}
__name(getDomainBranding, "getDomainBranding");
async function mergeDomainBranding(db, domain, patch) {
  if (!db) return defaultBrandingForDomain(domain);
  const key = domain.toLowerCase();
  const existing = await getDomainBranding(db, key);
  const next = {
    dmarcPolicy: patch.dmarcPolicy ?? existing.dmarcPolicy,
    dmarcRua: patch.dmarcRua?.trim() || existing.dmarcRua
  };
  await db.insert(domainBranding).values({
    domain: key,
    dmarcPolicy: next.dmarcPolicy,
    dmarcRua: next.dmarcRua
  }).onConflictDoUpdate({
    target: domainBranding.domain,
    set: {
      dmarcPolicy: next.dmarcPolicy,
      dmarcRua: next.dmarcRua
    }
  }).run();
  return next;
}
__name(mergeDomainBranding, "mergeDomainBranding");

// src/lib/branding.ts
function dmarcRecordName(domain) {
  return `_dmarc.${domain}`;
}
__name(dmarcRecordName, "dmarcRecordName");
function legacyBimiRecordName(domain) {
  return `default._bimi.${domain}`;
}
__name(legacyBimiRecordName, "legacyBimiRecordName");
function buildDmarcContent(config) {
  const rua = config.dmarcRua.trim().replace(/^mailto:/i, "");
  return `v=DMARC1; p=${config.dmarcPolicy}; rua=mailto:${rua}; adkim=s; aspf=s`;
}
__name(buildDmarcContent, "buildDmarcContent");
function txtRecordMatches(records, name, includes) {
  const target = name.toLowerCase();
  return records.find(
    (record) => record.type === "TXT" && record.name.toLowerCase() === target && record.content.includes(includes)
  );
}
__name(txtRecordMatches, "txtRecordMatches");
function parseDmarcPolicy(content) {
  const match2 = content.match(/;\s*p\s*=\s*(none|quarantine|reject)/i);
  if (!match2) return null;
  return match2[1].toLowerCase();
}
__name(parseDmarcPolicy, "parseDmarcPolicy");
async function getDomainBrandingConfig(db, domain) {
  return getDomainBranding(db, domain);
}
__name(getDomainBrandingConfig, "getDomainBrandingConfig");
async function mergeDomainBranding2(db, domain, patch) {
  return mergeDomainBranding(db, domain, patch);
}
__name(mergeDomainBranding2, "mergeDomainBranding");
async function fetchDomainBrandingStatus(db, cf, domain) {
  const normalizedDomain = domain.trim().toLowerCase();
  const config = await getDomainBrandingConfig(db, normalizedDomain);
  const dmarcExpected = buildDmarcContent(config);
  const notes = [
    "DMARC authenticates this domain's mail (SPF/DKIM alignment) \u2014 it does not control any inbox logo."
  ];
  const zoneId = await cf.resolveZoneId(normalizedDomain);
  if (!zoneId) {
    return {
      domain: normalizedDomain,
      zoneId: null,
      dnsConfigured: false,
      dnsCanApply: true,
      dnsApplyHint: null,
      settings: config,
      dmarc: {
        type: "TXT",
        name: dmarcRecordName(normalizedDomain),
        expected: dmarcExpected,
        current: null,
        found: false,
        recordId: null
      },
      dmarcEnforced: false,
      notes: [
        ...notes,
        "Could not resolve the Cloudflare zone ID for this domain."
      ]
    };
  }
  const records = await cf.listDnsRecords(zoneId);
  const dmarcRecord = txtRecordMatches(
    records,
    dmarcRecordName(normalizedDomain),
    "v=DMARC1"
  );
  const dmarcPolicy = (dmarcRecord && parseDmarcPolicy(dmarcRecord.content)) ?? null;
  const dmarcEnforced = dmarcPolicy === "quarantine" || dmarcPolicy === "reject";
  return {
    domain: normalizedDomain,
    zoneId,
    dnsConfigured: true,
    dnsCanApply: true,
    dnsApplyHint: null,
    settings: config,
    dmarc: {
      type: "TXT",
      name: dmarcRecordName(normalizedDomain),
      expected: dmarcExpected,
      current: dmarcRecord?.content ?? null,
      found: Boolean(dmarcRecord),
      recordId: dmarcRecord?.id ?? null
    },
    dmarcEnforced,
    notes
  };
}
__name(fetchDomainBrandingStatus, "fetchDomainBrandingStatus");
async function removeLegacyBimiRecord(cf, zoneId, domain) {
  const records = await cf.listDnsRecords(zoneId);
  const bimiRecord = txtRecordMatches(
    records,
    legacyBimiRecordName(domain),
    "v=BIMI1"
  );
  if (bimiRecord) {
    await cf.deleteDnsRecord(zoneId, bimiRecord.id);
  }
}
__name(removeLegacyBimiRecord, "removeLegacyBimiRecord");
async function applyDomainBrandingDns(db, cf, domain) {
  const normalizedDomain = domain.trim().toLowerCase();
  const config = await getDomainBrandingConfig(db, normalizedDomain);
  const zoneId = await cf.resolveZoneId(normalizedDomain);
  if (!zoneId) {
    throw new Error(
      `Could not resolve Cloudflare zone for ${normalizedDomain}.`
    );
  }
  await cf.upsertDnsRecord(zoneId, {
    type: "TXT",
    name: dmarcRecordName(normalizedDomain),
    content: buildDmarcContent(config),
    ttl: 1
  });
  await removeLegacyBimiRecord(cf, zoneId, normalizedDomain);
  return fetchDomainBrandingStatus(db, cf, normalizedDomain);
}
__name(applyDomainBrandingDns, "applyDomainBrandingDns");

// src/routes/console/branding.ts
var consoleBranding = new Hono2();
consoleBranding.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  let cf;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Cloudflare is not configured on this worker."
      },
      503
    );
  }
  const status = await fetchDomainBrandingStatus(createAppDb(c.env.RELAYBASE_DB), cf, domain);
  return c.json(status);
});
consoleBranding.put("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const body = await c.req.json();
  const domain = body.domain?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  await mergeDomainBranding2(createAppDb(c.env.RELAYBASE_DB), domain, {
    dmarcPolicy: body.dmarcPolicy,
    dmarcRua: body.dmarcRua
  });
  let cf;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Cloudflare is not configured on this worker."
      },
      503
    );
  }
  const status = await fetchDomainBrandingStatus(createAppDb(c.env.RELAYBASE_DB), cf, domain);
  return c.json(status);
});
consoleBranding.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const body = await c.req.json();
  const domain = body.domain?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  let cf;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Cloudflare is not configured on this worker."
      },
      503
    );
  }
  const status = await applyDomainBrandingDns(createAppDb(c.env.RELAYBASE_DB), cf, domain);
  return c.json(status);
});

// src/routes/console/keys.ts
init_app();
var consoleKeys = new Hono2();
consoleKeys.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = body.domain?.trim();
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  try {
    const { record, apiKey } = await createKey(createAppDb(c.env.RELAYBASE_DB), {
      domain,
      label: body.label
    });
    return c.json(
      {
        id: record.id,
        apiKey,
        domain: record.domain,
        label: record.label,
        createdAt: record.createdAt
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create key";
    return c.json({ error: message }, 400);
  }
});
consoleKeys.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const keys = await listKeys2(createAppDb(c.env.RELAYBASE_DB));
  return c.json({ keys });
});
consoleKeys.patch("/:id", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const id = c.req.param("id")?.trim();
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (typeof body.active !== "boolean") {
    return c.json({ error: "active boolean is required" }, 400);
  }
  const record = await setKeyActive2(createAppDb(c.env.RELAYBASE_DB), id, body.active);
  if (!record) {
    return c.json({ error: "Key not found" }, 404);
  }
  return c.json({ key: record });
});
consoleKeys.post("/:id/rotate", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const id = c.req.param("id")?.trim();
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }
  const rotated = await rotateKey(createAppDb(c.env.RELAYBASE_DB), id);
  if (!rotated) {
    return c.json({ error: "Key not found" }, 404);
  }
  return c.json({
    id: rotated.record.id,
    apiKey: rotated.apiKey,
    domain: rotated.record.domain,
    label: rotated.record.label,
    createdAt: rotated.record.createdAt
  });
});
consoleKeys.delete("/:id", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const id = c.req.param("id")?.trim();
  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }
  const deleted = await revokeKey(createAppDb(c.env.RELAYBASE_DB), id);
  if (!deleted) {
    return c.json({ error: "Key not found" }, 404);
  }
  return c.json({ ok: true, id });
});

// src/routes/console/mailbox-health.ts
init_app();
init_catalog_store();
init_messages();
var consoleMailboxHealth = new Hono2();
consoleMailboxHealth.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index (RELAYBASE_MAIL) is not configured" }, 503);
  }
  const staleDaysThreshold = Number(c.req.query("staleDays") ?? "1");
  const thresholdMs = Number.isFinite(staleDaysThreshold) && staleDaysThreshold > 0 ? staleDaysThreshold * 24 * 60 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  const [freshness, mailbox] = await Promise.all([
    mailboxFreshness(mailDb),
    readMailbox2(createAppDb(c.env.RELAYBASE_DB))
  ]);
  const retainedDomains = new Set(
    mailbox.domains.map((d) => d.trim().toLowerCase())
  );
  const now = Date.now();
  const byDomain = {};
  for (const domain of retainedDomains) {
    byDomain[domain] = {
      domain,
      inbound: { lastAt: null, count: 0, stale: true },
      sent: { lastAt: null, count: 0 }
    };
  }
  for (const row of freshness) {
    const domain = row.domain.trim().toLowerCase();
    if (!byDomain[domain]) {
      byDomain[domain] = {
        domain,
        inbound: { lastAt: null, count: 0, stale: true },
        sent: { lastAt: null, count: 0 }
      };
    }
    const bucket = byDomain[domain];
    if (row.kind === "inbound") {
      bucket.inbound = {
        lastAt: row.last_at,
        count: row.count,
        stale: row.last_at ? now - new Date(row.last_at).getTime() > thresholdMs : true
      };
    } else if (row.kind === "sent") {
      bucket.sent = { lastAt: row.last_at, count: row.count };
    }
  }
  return c.json({
    staleDaysThreshold,
    domains: Object.values(byDomain).sort((a, b) => a.domain.localeCompare(b.domain)),
    d1Configured: true,
    r2Configured: Boolean(c.env.INBOUND),
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    totalDomains: Object.keys(byDomain).length,
    staleDomains: Object.values(byDomain).filter((d) => d.inbound.stale).length,
    totalInbound: Object.values(byDomain).reduce(
      (sum, d) => sum + d.inbound.count,
      0
    ),
    totalSent: Object.values(byDomain).reduce((sum, d) => sum + d.sent.count, 0)
  });
});

// src/routes/console/settings.ts
init_app();

// db/app/settings.ts
init_drizzle_orm();
init_schema();
var MIN_INBOUND_RETAIN_PER_DOMAIN = 100;
function normalizeRetain(value) {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < MIN_INBOUND_RETAIN_PER_DOMAIN) return null;
  return value;
}
__name(normalizeRetain, "normalizeRetain");
async function getAppSettings(db) {
  if (!db) return { inboundRetainPerDomain: null };
  try {
    const row = await db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
    return {
      inboundRetainPerDomain: normalizeRetain(row?.inboundRetainPerDomain)
    };
  } catch {
    return { inboundRetainPerDomain: null };
  }
}
__name(getAppSettings, "getAppSettings");
async function setInboundRetainPerDomain(db, inboundRetainPerDomain) {
  if (!db) return { inboundRetainPerDomain: null };
  const value = normalizeRetain(inboundRetainPerDomain);
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await db.insert(appSettings).values({
    id: 1,
    inboundRetainPerDomain: value,
    updatedAt
  }).onConflictDoUpdate({
    target: appSettings.id,
    set: { inboundRetainPerDomain: value, updatedAt }
  }).run();
  return { inboundRetainPerDomain: value };
}
__name(setInboundRetainPerDomain, "setInboundRetainPerDomain");

// src/routes/console/settings.ts
var consoleSettings = new Hono2();
consoleSettings.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const db = createAppDb(c.env.RELAYBASE_DB);
  if (!db) {
    return c.json({ error: "Product database is not configured" }, 503);
  }
  const settings = await getAppSettings(db);
  return c.json({ inboundRetainPerDomain: settings.inboundRetainPerDomain });
});
consoleSettings.put("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  const db = createAppDb(c.env.RELAYBASE_DB);
  if (!db) {
    return c.json({ error: "Product database is not configured" }, 503);
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!("inboundRetainPerDomain" in body)) {
    return c.json({ error: "inboundRetainPerDomain is required" }, 400);
  }
  const raw2 = body.inboundRetainPerDomain;
  if (raw2 !== null && raw2 !== void 0) {
    if (typeof raw2 !== "number" || !Number.isInteger(raw2)) {
      return c.json(
        { error: "inboundRetainPerDomain must be an integer or null" },
        400
      );
    }
    if (raw2 < MIN_INBOUND_RETAIN_PER_DOMAIN) {
      return c.json(
        {
          error: `inboundRetainPerDomain must be at least ${MIN_INBOUND_RETAIN_PER_DOMAIN}, or null for unlimited`
        },
        400
      );
    }
  }
  const settings = await setInboundRetainPerDomain(
    db,
    raw2 === null || raw2 === void 0 ? null : raw2
  );
  return c.json({ inboundRetainPerDomain: settings.inboundRetainPerDomain });
});

// src/routes/console/sending-onboard.ts
init_cloudflare_config();

// src/lib/sending-onboard.ts
init_cloudflare_client();

// src/lib/sending-onboard-dns.ts
function isSendingOwnedDnsRecord(record, domain) {
  const d = domain.trim().toLowerCase();
  const name = record.name.trim().toLowerCase();
  const type = record.type.toUpperCase();
  if (!d || !name) return false;
  if (name !== `cf-bounce.${d}`) return false;
  return type === "MX" || type === "TXT";
}
__name(isSendingOwnedDnsRecord, "isSendingOwnedDnsRecord");

// src/lib/sending-health.ts
var RESTRICTED_ERROR = "Email Sending is not onboarded. Until it is, Cloudflare only delivers to verified destination addresses \u2014 other Relaybase mailboxes do not count.";
var DISABLED_ERROR = "Email Sending is disabled for this domain. Until it is enabled, Cloudflare only delivers to verified destination addresses \u2014 other Relaybase mailboxes do not count.";
var NO_ZONE_ERROR = "This domain is not a zone on the connected Cloudflare account.";
var UNKNOWN_ERROR = "Could not check Email Sending status.";
function sendingRowMatchesDomain(rowName, domain) {
  const name = rowName.trim().toLowerCase();
  const needle = domain.trim().toLowerCase();
  if (!name || !needle) return false;
  if (name === needle) return true;
  if (name.startsWith("*.")) {
    const suffix = name.slice(1);
    return needle.endsWith(suffix) && needle !== name.slice(2);
  }
  return false;
}
__name(sendingRowMatchesDomain, "sendingRowMatchesDomain");
function evaluateSendingHealth(input) {
  const domain = input.domain.trim().toLowerCase();
  if (!input.zoneId) {
    return {
      domain,
      status: "no_zone",
      sendingEnabled: false,
      sendingOnboarded: false,
      zoneId: null,
      error: NO_ZONE_ERROR
    };
  }
  const matches = (input.sendingRows ?? []).filter(
    (row) => sendingRowMatchesDomain(row.name, domain)
  );
  const enabledMatch = matches.find((row) => row.enabled);
  if (enabledMatch) {
    return {
      domain,
      status: "ready",
      sendingEnabled: true,
      sendingOnboarded: true,
      zoneId: input.zoneId,
      error: null
    };
  }
  const disabledMatch = matches.find((row) => !row.enabled);
  if (disabledMatch) {
    return {
      domain,
      status: "restricted",
      sendingEnabled: false,
      sendingOnboarded: true,
      zoneId: input.zoneId,
      error: DISABLED_ERROR
    };
  }
  if (input.hasCfBounceMx === true) {
    return {
      domain,
      status: "ready",
      sendingEnabled: true,
      sendingOnboarded: true,
      zoneId: input.zoneId,
      error: null
    };
  }
  if (input.sendingRows !== null || input.hasCfBounceMx === false) {
    return {
      domain,
      status: "restricted",
      sendingEnabled: false,
      sendingOnboarded: false,
      zoneId: input.zoneId,
      error: RESTRICTED_ERROR
    };
  }
  return {
    domain,
    status: "unknown",
    sendingEnabled: false,
    sendingOnboarded: false,
    zoneId: input.zoneId,
    error: UNKNOWN_ERROR
  };
}
__name(evaluateSendingHealth, "evaluateSendingHealth");
function unknownSendingHealthDomain(domain, error, cloudflareSendingUrl) {
  return {
    domain: domain.trim().toLowerCase(),
    status: "unknown",
    sendingEnabled: false,
    sendingOnboarded: false,
    zoneId: null,
    error,
    cloudflareSendingUrl
  };
}
__name(unknownSendingHealthDomain, "unknownSendingHealthDomain");
function sendingDashboardUrl(accountId) {
  const id = accountId?.trim() ?? "";
  if (id) return `https://dash.cloudflare.com/${id}/email-service/sending`;
  return "https://dash.cloudflare.com/?to=/:account/email-service/sending";
}
__name(sendingDashboardUrl, "sendingDashboardUrl");
async function collectSendingHealth(domains2, cf, opts = {}) {
  const generatedAt = opts.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const cloudflareSendingUrl = sendingDashboardUrl(opts.accountId);
  const unique = [
    ...new Set(domains2.map((d) => d.trim().toLowerCase()).filter(Boolean))
  ];
  if (!cf) {
    const error = opts.probeError ?? UNKNOWN_ERROR;
    return {
      generatedAt,
      domains: unique.map(
        (domain) => unknownSendingHealthDomain(domain, error, cloudflareSendingUrl)
      )
    };
  }
  let zones;
  try {
    zones = await cf.listZones();
  } catch (error) {
    const message = error instanceof Error ? error.message : UNKNOWN_ERROR;
    return {
      generatedAt,
      domains: unique.map(
        (domain) => unknownSendingHealthDomain(domain, message, cloudflareSendingUrl)
      )
    };
  }
  const zoneByName = new Map(
    zones.map((zone) => [zone.name.trim().toLowerCase(), zone])
  );
  const rows = await Promise.all(
    unique.map(async (domain) => {
      const zone = zoneByName.get(domain);
      if (!zone) {
        return {
          ...evaluateSendingHealth({
            domain,
            zoneId: null,
            sendingRows: [],
            hasCfBounceMx: false
          }),
          cloudflareSendingUrl
        };
      }
      let sendingRows = null;
      try {
        sendingRows = await cf.listSendingSubdomains(zone.id);
      } catch {
        sendingRows = null;
      }
      const apexEnabled = (sendingRows ?? []).some(
        (row) => sendingRowMatchesDomain(row.name, domain) && row.enabled
      );
      let hasCfBounceMx = null;
      if (!apexEnabled) {
        try {
          hasCfBounceMx = await cf.hasSendingBounceMx(zone.id, domain);
        } catch {
          hasCfBounceMx = null;
        }
      }
      return {
        ...evaluateSendingHealth({
          domain,
          zoneId: zone.id,
          sendingRows,
          hasCfBounceMx
        }),
        cloudflareSendingUrl
      };
    })
  );
  return { generatedAt, domains: rows };
}
__name(collectSendingHealth, "collectSendingHealth");

// src/lib/sending-onboard.ts
var NO_ZONE_ERROR2 = "This domain is not a zone on the connected Cloudflare account.";
var CONFIRM_ERROR = "These DNS records would be replaced. Confirm to delete them and continue.";
function toConflict(record) {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    content: record.content,
    priority: record.priority ?? null
  };
}
__name(toConflict, "toConflict");
async function listSendingDnsConflicts(cf, zoneId, domain) {
  const d = domain.trim().toLowerCase();
  const bounce = `cf-bounce.${d}`;
  const [mxBounce, txtBounce] = await Promise.all([
    cf.listDnsRecords(zoneId, { type: "MX", name: bounce }),
    cf.listDnsRecords(zoneId, { type: "TXT", name: bounce })
  ]);
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const record of [...mxBounce, ...txtBounce]) {
    if (!isSendingOwnedDnsRecord(record, d) || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(toConflict(record));
  }
  return out;
}
__name(listSendingDnsConflicts, "listSendingDnsConflicts");
async function enableOrCreateSending(cf, zoneId, domain) {
  const rows = await cf.listSendingSubdomains(zoneId);
  const match2 = rows.find((row) => sendingRowMatchesDomain(row.name, domain));
  if (match2 && !match2.enabled) {
    await cf.updateSendingSubdomain(zoneId, match2.name, { enabled: true });
    return;
  }
  if (match2?.enabled) return;
  await cf.createSendingSubdomain(zoneId, domain);
}
__name(enableOrCreateSending, "enableOrCreateSending");
async function onboardSendingDomain(cf, domainInput, opts = {}) {
  const domain = domainInput.trim().toLowerCase();
  const zoneId = await cf.resolveZoneId(domain);
  if (!zoneId) {
    return { ok: false, code: "no_zone", domain, error: NO_ZONE_ERROR2 };
  }
  const records = await listSendingDnsConflicts(cf, zoneId, domain);
  if (records.length > 0 && !opts.confirmReplace) {
    return {
      ok: false,
      code: "needs_confirm",
      domain,
      zoneId,
      records,
      error: CONFIRM_ERROR
    };
  }
  if (opts.confirmReplace) {
    for (const record of records) {
      try {
        await cf.deleteDnsRecord(zoneId, record.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("[1046]")) continue;
        throw error;
      }
    }
  }
  try {
    await enableOrCreateSending(cf, zoneId, domain);
  } catch (error) {
    if (error instanceof SendingOnboardApiMissingError) {
      return {
        ok: false,
        code: "unavailable",
        domain,
        error: error.message,
        cloudflareSendingUrl: sendingDashboardUrl(opts.accountId)
      };
    }
    throw error;
  }
  const snapshot = await collectSendingHealth([domain], cf, {
    accountId: opts.accountId
  });
  const row = snapshot.domains[0];
  if (!row) {
    return {
      ok: false,
      code: "unavailable",
      domain,
      error: "Onboard finished but sending health returned no row.",
      cloudflareSendingUrl: sendingDashboardUrl(opts.accountId)
    };
  }
  return { ok: true, domain: row };
}
__name(onboardSendingDomain, "onboardSendingDomain");

// src/routes/console/sending-onboard.ts
var consoleSendingOnboard = new Hono2();
consoleSendingOnboard.post("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = typeof body.domain === "string" ? body.domain.trim() : "";
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  const confirmReplace = body.confirmReplace === true;
  let cf;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Cloudflare API is not configured on this worker"
      },
      503
    );
  }
  try {
    const result = await onboardSendingDomain(cf, domain, {
      confirmReplace,
      accountId: c.env.CF_ACCOUNT_ID
    });
    if (result.ok) {
      return c.json({ domain: result.domain });
    }
    if (result.code === "no_zone") {
      return c.json(
        { error: result.error, code: result.code, domain: result.domain },
        400
      );
    }
    if (result.code === "needs_confirm") {
      return c.json(
        {
          error: result.error,
          code: result.code,
          domain: result.domain,
          zoneId: result.zoneId,
          records: result.records
        },
        409
      );
    }
    return c.json(
      {
        error: result.error,
        code: result.code,
        domain: result.domain,
        cloudflareSendingUrl: result.cloudflareSendingUrl
      },
      502
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sending onboard failed";
    return c.json({ error: message }, 502);
  }
});

// src/routes/console/zones.ts
init_cloudflare_config();
var consoleZones = new Hono2();
consoleZones.get("/", async (c) => {
  const denied = await requireConsoleSession(c);
  if (denied) return denied;
  let cf;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Cloudflare API is not configured on this worker \u2014 add a CF_API_TOKEN secret (Email Sending + Email Routing + Zone Read) so the Worker can manage domains and DNS"
      },
      503
    );
  }
  try {
    const zones = await cf.listZones();
    return c.json({ zones });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list zones";
    return c.json({ error: message }, 502);
  }
});

// src/routes/mail/addresses.ts
init_app();
init_catalog_store();
var mailAddresses = new Hono2();
mailAddresses.get("/", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const data = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  return c.json({ addresses: data.addresses });
});

// src/routes/mail/favicon.ts
var mailFavicon = new Hono2();
var FETCH_TIMEOUT_MS = 5e3;
var MAX_ICON_BYTES = 256 * 1024;
var ICON_PATHS = ["/favicon.ico", "/apple-touch-icon.png", "/favicon.svg"];
function sanitizeDomain(raw2) {
  const domain = (raw2 ?? "").trim().toLowerCase();
  if (!domain || !domain.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(domain)) return null;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return null;
  }
  return domain;
}
__name(sanitizeDomain, "sanitizeDomain");
function iconContentType(res, path) {
  const type = res.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
  if (type?.startsWith("image/")) return type;
  if (path.endsWith(".ico") && (!type || type === "application/octet-stream")) {
    return "image/x-icon";
  }
  if (path.endsWith(".svg") && type === "text/xml") return "image/svg+xml";
  return null;
}
__name(iconContentType, "iconContentType");
function toBase64(bytes) {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}
__name(toBase64, "toBase64");
async function fetchIcon(domain, path) {
  try {
    const res = await fetch(`https://${domain}${path}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "image/*" }
    });
    if (!res.ok) return null;
    const contentType = iconContentType(res, path);
    if (!contentType) return null;
    const declaredLength = Number(res.headers.get("Content-Length") ?? "0");
    if (declaredLength > MAX_ICON_BYTES) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ICON_BYTES) return null;
    return `data:${contentType};base64,${toBase64(bytes)}`;
  } catch {
    return null;
  }
}
__name(fetchIcon, "fetchIcon");
mailFavicon.get("/", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = sanitizeDomain(c.req.query("domain"));
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  let dataUrl = null;
  for (const path of ICON_PATHS) {
    dataUrl = await fetchIcon(domain, path);
    if (dataUrl) break;
  }
  c.header("Cache-Control", "private, max-age=86400");
  return c.json({ domain, dataUrl });
});

// src/routes/mail/inbox.ts
init_cloudflare_config();
init_app();

// src/lib/inbound-search.ts
var MIN_SEARCH_QUERY_LENGTH = 2;

// src/lib/inbound-serialize.ts
function decodeSubject(subject) {
  return decodeMimeHeader(subject) || subject || "(no subject)";
}
__name(decodeSubject, "decodeSubject");
function serializeInboundListItem(message) {
  return {
    key: message.id,
    fromEmail: message.fromEmail,
    fromName: message.fromName ?? null,
    toEmail: message.toEmail,
    toEmails: message.toEmails?.length ? message.toEmails : [message.toEmail],
    ccEmails: message.ccEmails ?? [],
    subject: decodeSubject(message.subject),
    status: "stored",
    action: "worker",
    receivedAt: message.receivedAt,
    bodyPreview: message.bodyPreview,
    attachmentCount: message.attachments.length,
    messageId: message.messageId,
    inReplyTo: message.inReplyTo ?? null,
    references: message.references ?? null,
    size: message.size,
    readAt: message.readAt ?? null
  };
}
__name(serializeInboundListItem, "serializeInboundListItem");
function serializeInboundMessage(message) {
  return {
    key: message.id,
    fromEmail: message.fromEmail,
    fromName: message.fromName ?? null,
    toEmail: message.toEmail,
    toEmails: message.toEmails?.length ? message.toEmails : [message.toEmail],
    ccEmails: message.ccEmails ?? [],
    subject: decodeSubject(message.subject),
    status: "stored",
    action: "worker",
    receivedAt: message.receivedAt,
    bodyPreview: message.bodyPreview,
    bodyText: message.bodyText,
    bodyHtml: message.bodyHtml,
    messageId: message.messageId,
    inReplyTo: message.inReplyTo ?? null,
    references: message.references ?? null,
    size: message.size,
    readAt: message.readAt ?? null,
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      filename: decodeMimeHeader(attachment.filename) || attachment.filename
    }))
  };
}
__name(serializeInboundMessage, "serializeInboundMessage");

// src/routes/mail/inbox.ts
init_messages();
init_catalog_store();
var mailInbox = new Hono2();
mailInbox.get("/notifications", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const limit = Number(c.req.query("limit") ?? "25");
  const { listPendingEvents: listPendingEvents2 } = await Promise.resolve().then(() => (init_inbound_events2(), inbound_events_exports));
  const events = await listPendingEvents2(createAppDb(c.env.RELAYBASE_DB), domain, limit);
  return c.json({ events });
});
mailInbox.post("/notifications/ack", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = body.domain?.trim().toLowerCase();
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  const { ackPendingEvents: ackPendingEvents2 } = await Promise.resolve().then(() => (init_inbound_events2(), inbound_events_exports));
  const acked = await ackPendingEvents2(createAppDb(c.env.RELAYBASE_DB), domain, ids);
  return c.json({ acked });
});
function serializeMessage(message) {
  if (!message) return null;
  return serializeInboundMessage(message);
}
__name(serializeMessage, "serializeMessage");
mailInbox.get("/counts", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index is not configured" }, 503);
  }
  const byAddress = await mailboxAddressCounts(mailDb, "inbound", domain);
  let totalAll = 0;
  let unreadAll = 0;
  const counts = {};
  for (const [address, value] of Object.entries(byAddress)) {
    counts[address] = value;
    totalAll += value.total;
    unreadAll += value.unread;
  }
  return c.json({ counts, totalAll, unreadAll });
});
mailInbox.get("/search", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const q = c.req.query("q")?.trim() ?? "";
  if (q.length < MIN_SEARCH_QUERY_LENGTH) {
    return c.json(
      { error: `q must be at least ${MIN_SEARCH_QUERY_LENGTH} characters` },
      400
    );
  }
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index is not configured" }, 503);
  }
  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || void 0;
  const page = await searchMailbox(mailDb, {
    kind: "inbound",
    domains: [domain],
    q,
    limit: Number.isFinite(limit) ? limit : 50,
    before
  });
  return c.json({
    messages: page.rows.map(
      (row) => serializeInboundListItem(rowToInboundMeta(row))
    ),
    total: page.total,
    nextBefore: page.nextBefore,
    hasMore: page.hasMore
  });
});
function rowToInboundMeta(row) {
  return {
    id: row.id,
    domain: row.domain,
    fromEmail: row.from_email,
    fromName: row.from_name ?? void 0,
    toEmail: row.to_email,
    toEmails: row.to_emails ? row.to_emails.split(",").filter(Boolean) : [],
    ccEmails: row.cc_emails ? row.cc_emails.split(",").filter(Boolean) : [],
    subject: row.subject,
    receivedAt: row.occurred_at,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.refs,
    size: row.size,
    bodyPreview: row.body_preview,
    bodyText: "",
    bodyHtml: null,
    attachments: Array.from({ length: row.attachment_count }, (_, i) => ({
      id: String(i),
      filename: "",
      contentType: "application/octet-stream",
      size: 0,
      disposition: "attachment",
      contentId: null
    })),
    readAt: row.read_at
  };
}
__name(rowToInboundMeta, "rowToInboundMeta");
mailInbox.post("/read", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = body.domain?.trim().toLowerCase();
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  if (typeof body.read !== "boolean") {
    return c.json({ error: "read must be a boolean" }, 400);
  }
  const readAt = body.read ? (/* @__PURE__ */ new Date()).toISOString() : null;
  const result = await setMailReadState(
    c.env.INBOUND,
    domain,
    ids,
    readAt,
    createMailDb(c.env.RELAYBASE_MAIL)
  );
  return c.json(result);
});
mailInbox.get("/", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index is not configured" }, 503);
  }
  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || void 0;
  const page = await listMailboxPage(mailDb, {
    kind: "inbound",
    domain,
    limit: Number.isFinite(limit) ? limit : 50,
    before
  });
  return c.json({
    messages: page.rows.map(
      (row) => serializeInboundListItem(rowToInboundMeta(row))
    ),
    nextBefore: page.nextBefore,
    hasMore: page.hasMore,
    total: page.total,
    unread: page.unread
  });
});
mailInbox.get("/:id/attachments/:attachmentId", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const result = await getInboundAttachment(c.env.INBOUND, {
    domain,
    messageId: c.req.param("id"),
    attachmentId: c.req.param("attachmentId")
  });
  if (!result) {
    return c.json({ error: "Attachment not found" }, 404);
  }
  const encoded = encodeURIComponent(result.meta.filename);
  return new Response(result.body, {
    headers: {
      "Content-Type": result.meta.contentType,
      "Content-Disposition": `${result.meta.disposition === "inline" ? "inline" : "attachment"}; filename="${result.meta.filename}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, max-age=3600"
    }
  });
});
mailInbox.get("/routing", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const mailbox = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  const requested = c.req.query("domain")?.trim().toLowerCase();
  const domains2 = requested ? [requested] : mailbox.domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean);
  try {
    const cf = await createCloudflareClient(c.env);
    const results = await Promise.all(
      domains2.map(async (domain) => {
        try {
          return await listInboundRouting(cf, domain);
        } catch (error) {
          return {
            domain,
            error: error instanceof Error ? error.message : "Failed to list routing"
          };
        }
      })
    );
    return c.json({ domains: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list routing";
    return c.json({ error: message }, 502);
  }
});
mailInbox.post("/routing", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = body.domain?.trim().toLowerCase();
  const addresses2 = body.addresses?.map((address) => address.trim().toLowerCase()).filter(Boolean);
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  if (!addresses2?.length) {
    return c.json({ error: "addresses must be a non-empty array" }, 400);
  }
  try {
    const mailbox = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
    const byEmail = new Map(
      mailbox.addresses.map((a) => [a.email.toLowerCase(), a])
    );
    const entries = addresses2.map((address) => ({
      address,
      inboundEnabled: byEmail.get(address)?.inboundEnabled !== false
    }));
    const cf = await createCloudflareClient(c.env);
    const result = await ensureInboundRouting(
      cf,
      domain,
      entries,
      c.env.WORKER_SCRIPT_NAME
    );
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to configure routing";
    return c.json({ error: message }, 502);
  }
});
mailInbox.delete("/routing", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = body.domain?.trim().toLowerCase();
  const addresses2 = body.addresses?.map((address) => address.trim().toLowerCase()).filter(Boolean);
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  if (!addresses2?.length) {
    return c.json({ error: "addresses must be a non-empty array" }, 400);
  }
  try {
    const cf = await createCloudflareClient(c.env);
    const result = await removeInboundWorkerRouting(
      cf,
      domain,
      addresses2
    );
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove routing";
    return c.json({ error: message }, 502);
  }
});
mailInbox.get("/:id", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const message = await getMailMessage(c.env.INBOUND, "inbound", domain, c.req.param("id"));
  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }
  return c.json({ message: serializeMessage(message) });
});

// src/lib/mail/send-message.ts
init_cloudflare_api_hints();
init_email_send();
init_ops_logs();
init_send_logs();
init_mime();

// src/lib/mail/local-deliver.ts
init_app();
init_catalog_store();
init_inbound_events2();

// db/app/webhooks.ts
init_drizzle_orm();
init_schema();
function rowToWebhookRecord(row) {
  const { secretHash: _secretHash, ...record } = row;
  return {
    id: record.id,
    domain: record.domain,
    url: record.url,
    createdAt: record.createdAt,
    active: record.active === 1
  };
}
__name(rowToWebhookRecord, "rowToWebhookRecord");
function rowToStoredWebhook(row) {
  return {
    id: row.id,
    domain: row.domain,
    url: row.url,
    secretHash: row.secretHash,
    createdAt: row.createdAt,
    active: row.active === 1
  };
}
__name(rowToStoredWebhook, "rowToStoredWebhook");
async function listWebhooks(db, domain) {
  if (!db) return [];
  const rows = await db.select().from(webhooks).where(and(eq(webhooks.domain, domain.trim().toLowerCase()), eq(webhooks.active, 1))).all();
  return rows.map(rowToWebhookRecord);
}
__name(listWebhooks, "listWebhooks");
async function listStoredWebhooks(db, domain) {
  if (!db) return [];
  const rows = await db.select().from(webhooks).where(eq(webhooks.domain, domain.trim().toLowerCase())).all();
  return rows.map(rowToStoredWebhook);
}
__name(listStoredWebhooks, "listStoredWebhooks");
async function createWebhookRow(db, input) {
  if (!db) return;
  await db.insert(webhooks).values({
    id: input.id,
    domain: input.domain.trim().toLowerCase(),
    url: input.url,
    secretHash: input.secretHash,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    active: 1
  }).run();
}
__name(createWebhookRow, "createWebhookRow");
async function deleteWebhookRow(db, id) {
  if (!db) return false;
  const result = await db.delete(webhooks).where(eq(webhooks.id, id)).run();
  return result.meta.changes > 0;
}
__name(deleteWebhookRow, "deleteWebhookRow");
async function storeWebhookSecret(db, webhookId, secret) {
  if (!db) return;
  await db.insert(webhookSecrets).values({ webhookId, secret }).onConflictDoUpdate({
    target: webhookSecrets.webhookId,
    set: { secret }
  }).run();
}
__name(storeWebhookSecret, "storeWebhookSecret");
async function getWebhookSecret(db, webhookId) {
  if (!db) return null;
  const row = await db.select().from(webhookSecrets).where(eq(webhookSecrets.webhookId, webhookId)).get();
  return row?.secret ?? null;
}
__name(getWebhookSecret, "getWebhookSecret");
async function recordWebhookFail(db, input) {
  if (!db) return;
  await db.insert(webhookFails).values({
    id: input.id,
    webhookId: input.webhookId,
    eventId: input.eventId,
    url: input.url,
    failedAt: input.failedAt,
    expiresAt: input.expiresAt
  }).run();
}
__name(recordWebhookFail, "recordWebhookFail");
async function deleteExpiredWebhookFails(db, now) {
  if (!db) return;
  await db.delete(webhookFails).where(lt(webhookFails.expiresAt, now)).run();
}
__name(deleteExpiredWebhookFails, "deleteExpiredWebhookFails");

// src/lib/webhooks.ts
var MAX_WEBHOOKS_PER_DOMAIN = 3;
var WEBHOOK_SECRET_PREFIX = "whsec_";
var FAIL_TTL_SECONDS = 7 * 24 * 60 * 60;
function bytesToHex4(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex4, "bytesToHex");
function generateWebhookSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const encoded = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${WEBHOOK_SECRET_PREFIX}${encoded}`;
}
__name(generateWebhookSecret, "generateWebhookSecret");
function isValidWebhookUrl(url) {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
__name(isValidWebhookUrl, "isValidWebhookUrl");
async function hmacSha256Hex2(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return bytesToHex4(new Uint8Array(signature));
}
__name(hmacSha256Hex2, "hmacSha256Hex");
async function listWebhooks2(db, domain) {
  return listWebhooks(db, domain);
}
__name(listWebhooks2, "listWebhooks");
async function createWebhook(db, params) {
  const domain = params.domain.trim().toLowerCase();
  const url = params.url.trim();
  if (!isValidWebhookUrl(url)) {
    throw new Error("url must be a valid http(s) URL");
  }
  const existing = await listWebhooks2(db, domain);
  if (existing.length >= MAX_WEBHOOKS_PER_DOMAIN) {
    throw new Error(`maximum ${MAX_WEBHOOKS_PER_DOMAIN} webhooks per domain`);
  }
  const secret = params.secret?.trim() || generateWebhookSecret();
  const id = crypto.randomUUID();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  await createWebhookRow(db, {
    id,
    domain,
    url,
    secretHash: await sha256Hex(secret)
  });
  await storeWebhookSecret2(db, id, secret);
  return {
    webhook: { id, domain, url, createdAt, active: true },
    secret
  };
}
__name(createWebhook, "createWebhook");
async function deleteWebhook(db, domain, id) {
  return deleteWebhookRow(db, id);
}
__name(deleteWebhook, "deleteWebhook");
async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
async function postWebhook(webhook, secret, event) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1e3);
  const signedPayload = `${timestamp}.${body}`;
  const signature = await hmacSha256Hex2(secret, signedPayload);
  const res = await fetch(webhook.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Relaybase-Signature": `t=${timestamp},v1=${signature}`,
      "X-Relaybase-Event-Id": event.id,
      "X-Relaybase-Event-Type": event.type
    },
    body
  });
  return res.ok;
}
__name(postWebhook, "postWebhook");
async function deliverWebhooks(db, domain, event) {
  const webhooks2 = await listStoredWebhooks(db, domain);
  const delays = [0, 1e3, 4e3, 16e3];
  for (const webhook of webhooks2) {
    if (!webhook.active) continue;
    const secret = await getWebhookSecret(db, webhook.id);
    if (!secret) continue;
    let delivered = false;
    for (const delay of delays) {
      if (delay > 0) await sleep(delay);
      try {
        if (await postWebhook(webhook, secret, event)) {
          delivered = true;
          break;
        }
      } catch (error) {
        console.error("Webhook delivery failed", webhook.url, error);
      }
    }
    if (!delivered) {
      const failedAt = (/* @__PURE__ */ new Date()).toISOString();
      await recordWebhookFail(db, {
        id: `${webhook.id}:${event.id}`,
        webhookId: webhook.id,
        eventId: event.id,
        url: webhook.url,
        failedAt,
        expiresAt: new Date(
          new Date(failedAt).getTime() + FAIL_TTL_SECONDS * 1e3
        ).toISOString()
      });
    }
  }
  await deleteExpiredWebhookFails(db, (/* @__PURE__ */ new Date()).toISOString());
}
__name(deliverWebhooks, "deliverWebhooks");
async function storeWebhookSecret2(db, webhookId, secret) {
  await storeWebhookSecret(db, webhookId, secret);
}
__name(storeWebhookSecret2, "storeWebhookSecret");

// src/lib/mail/local-deliver-select.ts
function selectLocalInboundRecipients(recipients, addresses2, skip = []) {
  const skipped = new Set(
    [...skip].map((address) => address.trim().toLowerCase()).filter(Boolean)
  );
  const enabled = /* @__PURE__ */ new Set();
  for (const row of addresses2) {
    if (row.inboundEnabled === false) continue;
    const email = row.email.trim().toLowerCase();
    if (email) enabled.add(email);
  }
  const seen = /* @__PURE__ */ new Set();
  const local = [];
  for (const raw2 of recipients) {
    const email = raw2.trim().toLowerCase();
    if (!email || skipped.has(email) || seen.has(email)) continue;
    if (!enabled.has(email)) continue;
    seen.add(email);
    local.push(email);
  }
  return local;
}
__name(selectLocalInboundRecipients, "selectLocalInboundRecipients");

// src/lib/mail/local-deliver.ts
async function dispatchLocalInboundEvent(db, record) {
  const event = await enqueueInboundEvent(db, record);
  await deliverWebhooks(db, record.domain, event);
}
__name(dispatchLocalInboundEvent, "dispatchLocalInboundEvent");
async function deliverToLocalInboxes(env, params) {
  if (!env.INBOUND) return;
  try {
    const appDb = createAppDb(env.RELAYBASE_DB);
    const mailbox = await readMailbox2(appDb);
    const local = selectLocalInboundRecipients(
      [...params.to, ...params.cc ?? []],
      mailbox.addresses,
      params.skipAddresses
    );
    if (local.length === 0) return;
    const raw2 = new TextEncoder().encode(params.rawMime);
    const rawBuffer = raw2.buffer.slice(
      raw2.byteOffset,
      raw2.byteOffset + raw2.byteLength
    );
    const mailDb = createMailDb(env.RELAYBASE_MAIL);
    for (const toEmail of local) {
      try {
        const { record, created } = await storeInboundMail(
          env.INBOUND,
          {
            envelopeFrom: params.from,
            toEmail,
            subject: params.subject,
            messageId: params.messageId,
            inReplyTo: params.inReplyTo ?? null,
            references: params.references ?? null,
            size: raw2.byteLength,
            raw: rawBuffer
          },
          mailDb
        );
        if (!created) continue;
        const notify = dispatchLocalInboundEvent(appDb, record);
        if (params.waitUntil) {
          params.waitUntil(
            notify.catch((error) => {
              console.error("Failed to dispatch local inbound event", error);
            })
          );
        } else {
          await notify;
        }
      } catch (error) {
        console.error("Failed to locally deliver inbound mail", toEmail, error);
      }
    }
  } catch (error) {
    console.error("Failed to locally deliver inbound mail", error);
  }
}
__name(deliverToLocalInboxes, "deliverToLocalInboxes");

// src/lib/recipients.ts
var EMAIL_RE2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function splitRecipientInput(input) {
  return input.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
}
__name(splitRecipientInput, "splitRecipientInput");
function normalizeRecipients(value) {
  if (!value) return [];
  const raw2 = Array.isArray(value) ? value : [value];
  const seen = /* @__PURE__ */ new Set();
  const emails = [];
  for (const entry of raw2) {
    for (const part of splitRecipientInput(entry)) {
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      emails.push(part);
    }
  }
  return emails;
}
__name(normalizeRecipients, "normalizeRecipients");
function findInvalidRecipients(emails) {
  return emails.filter((email) => !EMAIL_RE2.test(email));
}
__name(findInvalidRecipients, "findInvalidRecipients");

// src/lib/mail/send-message.ts
async function persistSendLog(env, entry) {
  try {
    await recordSendLog(env.INBOUND, entry);
  } catch (error) {
    console.error("Failed to record send log", error);
  }
}
__name(persistSendLog, "persistSendLog");
async function sendMailMessage(env, body, source, options) {
  const from = body.from?.trim();
  const to = normalizeRecipients(body.to);
  const cc = normalizeRecipients(body.cc);
  const subject = body.subject?.trim();
  const text2 = body.text?.trim();
  const domain = from ? from.split("@").pop()?.toLowerCase() ?? null : null;
  const toJoined = to.join(", ") || null;
  const ccJoined = cc.length ? cc.join(", ") : void 0;
  if (!from || !to.length || !subject || !text2) {
    await persistSendLog(env, {
      ok: false,
      status: 400,
      domain,
      keyId: null,
      keyPrefix: null,
      keyLabel: source,
      from: from ?? null,
      to: toJoined,
      subject: subject ?? null,
      error: "from, to, subject, and text are required"
    });
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "api_error",
      ok: false,
      status: 400,
      source,
      domain,
      fromAddr: from ?? null,
      toAddr: toJoined,
      subject: subject ?? null,
      error: "from, to, subject, and text are required"
    });
    return {
      response: new Response(
        JSON.stringify({ error: "from, to, subject, and text are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    };
  }
  const invalid = [...findInvalidRecipients(to), ...findInvalidRecipients(cc)];
  if (invalid.length) {
    await persistSendLog(env, {
      ok: false,
      status: 400,
      domain,
      keyId: null,
      keyPrefix: null,
      keyLabel: source,
      from,
      to: toJoined,
      subject,
      error: `Invalid email address: ${invalid.join(", ")}`
    });
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "api_error",
      ok: false,
      status: 400,
      source,
      domain,
      fromAddr: from,
      toAddr: toJoined,
      subject,
      error: `Invalid email address: ${invalid.join(", ")}`
    });
    return {
      response: new Response(
        JSON.stringify({ error: `Invalid email address: ${invalid.join(", ")}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    };
  }
  try {
    const result = await sendOutboundEmail(env, {
      from,
      fromName: body.fromName?.trim() || void 0,
      to: to.length === 1 ? to[0] : to,
      cc: cc.length ? cc.length === 1 ? cc[0] : cc : void 0,
      subject,
      text: text2,
      html: body.html,
      replyTo: body.replyTo,
      inReplyTo: body.inReplyTo?.trim() || void 0,
      references: body.references?.trim() || void 0
    });
    const hadBounces = result.permanentBounces.length > 0;
    const allFailed = result.delivered.length === 0 && result.queued.length === 0 && hadBounces;
    const meta = {
      delivered: result.delivered,
      queued: result.queued
    };
    if (hadBounces) {
      meta.permanentBounces = result.permanentBounces;
    }
    if (allFailed) {
      const error = `All recipients permanently bounced: ${result.permanentBounces.join(", ")}`;
      await persistSendLog(env, {
        ok: false,
        status: 502,
        domain,
        keyId: null,
        keyPrefix: null,
        keyLabel: source,
        from,
        to: toJoined,
        subject,
        messageId: result.messageId,
        error
      });
      await recordOpsLog(env.RELAYBASE_LOGS, {
        kind: "send",
        ok: false,
        status: 502,
        source,
        domain,
        fromAddr: from,
        toAddr: toJoined,
        subject,
        messageId: result.messageId,
        error,
        metaJson: JSON.stringify(meta)
      });
      return {
        response: new Response(
          JSON.stringify({ error, messageId: result.messageId }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        )
      };
    }
    const ok = !hadBounces;
    await persistSendLog(env, {
      ok,
      status: 200,
      domain,
      keyId: null,
      keyPrefix: null,
      keyLabel: source,
      from,
      to: toJoined,
      subject,
      messageId: result.messageId,
      error: hadBounces ? `Some recipients permanently bounced: ${result.permanentBounces.join(", ")}` : void 0
    });
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "send",
      ok,
      status: 200,
      source,
      domain,
      fromAddr: from,
      toAddr: toJoined,
      subject,
      messageId: result.messageId,
      error: hadBounces ? `Some recipients permanently bounced: ${result.permanentBounces.join(", ")}` : null,
      metaJson: JSON.stringify(meta)
    });
    const rawMime = buildMimeMessage({
      from,
      fromName: body.fromName?.trim() || void 0,
      to: to.length === 1 ? to[0] : to,
      cc: cc.length ? cc : void 0,
      subject,
      text: text2,
      html: body.html,
      replyTo: body.replyTo,
      messageId: result.messageId,
      inReplyTo: body.inReplyTo?.trim() || void 0,
      references: body.references?.trim() || void 0
    });
    if (domain) {
      try {
        await storeSentMail(
          env.INBOUND,
          {
            from,
            fromName: body.fromName?.trim() || void 0,
            to,
            cc: cc.length ? cc : void 0,
            subject,
            text: text2,
            html: body.html,
            messageId: result.messageId,
            inReplyTo: body.inReplyTo?.trim() || null,
            references: body.references?.trim() || null,
            rawMime
          },
          createMailDb(env.RELAYBASE_MAIL)
        );
      } catch (error) {
        console.error("Failed to persist sent mail", error);
      }
    }
    await deliverToLocalInboxes(env, {
      from,
      to,
      cc: cc.length ? cc : void 0,
      subject,
      messageId: result.messageId,
      inReplyTo: body.inReplyTo?.trim() || null,
      references: body.references?.trim() || null,
      rawMime,
      skipAddresses: result.permanentBounces,
      waitUntil: options?.waitUntil
    });
    return {
      response: new Response(
        JSON.stringify({ messageId: result.messageId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    await persistSendLog(env, {
      ok: false,
      status: 502,
      domain,
      keyId: null,
      keyPrefix: null,
      keyLabel: source,
      from,
      to: toJoined,
      subject,
      error: message
    });
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "send",
      ok: false,
      status: 502,
      source,
      domain,
      fromAddr: from,
      toAddr: toJoined,
      subject,
      error: message
    });
    return {
      response: new Response(JSON.stringify(cloudflareSendErrorBody(message)), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      })
    };
  }
}
__name(sendMailMessage, "sendMailMessage");

// src/routes/mail/send.ts
var mailSend = new Hono2();
mailSend.post("/", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  let body;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const result = await sendMailMessage(c.env, body, "compose", {
    waitUntil: /* @__PURE__ */ __name((promise) => c.executionCtx.waitUntil(promise), "waitUntil")
  });
  return result.response;
});

// src/routes/mail/sending-health.ts
init_app();
init_catalog_store();
init_cloudflare_config();
var mailSendingHealth = new Hono2();
mailSendingHealth.get("/", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const mailbox = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  let cf = null;
  let probeError;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    probeError = error instanceof Error ? error.message : UNKNOWN_ERROR;
  }
  const snapshot = await collectSendingHealth(mailbox.domains, cf, {
    accountId: c.env.CF_ACCOUNT_ID,
    probeError
  });
  return c.json(snapshot);
});

// src/routes/mail/sent.ts
init_messages();
var mailSent = new Hono2();
function rowToSentItem(row) {
  return {
    id: row.id,
    from: row.from_email,
    fromName: row.from_name ?? null,
    to: row.to_emails ?? row.to_email,
    cc: row.cc_emails ?? "",
    subject: row.subject,
    bodyPreview: row.body_preview,
    sentAt: row.occurred_at,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.refs,
    size: row.size,
    attachmentCount: row.attachment_count
  };
}
__name(rowToSentItem, "rowToSentItem");
mailSent.get("/", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index is not configured" }, 503);
  }
  const rawLimit = c.req.query("limit");
  const limit = rawLimit ? Number(rawLimit) : 5e3;
  const before = c.req.query("before")?.trim() || void 0;
  const q = c.req.query("q")?.trim() || void 0;
  if (q && q.length >= MIN_SEARCH_QUERY_LENGTH) {
    const page2 = await searchMailbox(mailDb, {
      kind: "sent",
      domains: [domain],
      q,
      limit: Number.isFinite(limit) ? limit : 50,
      before
    });
    return c.json({
      sent: page2.rows.map(rowToSentItem),
      nextBefore: page2.nextBefore,
      hasMore: page2.hasMore,
      total: page2.total
    });
  }
  const page = await listMailboxPage(mailDb, {
    kind: "sent",
    domain,
    limit: Number.isFinite(limit) ? limit : 5e3,
    before
  });
  return c.json({
    sent: page.rows.map(rowToSentItem),
    nextBefore: page.nextBefore,
    hasMore: page.hasMore,
    total: page.total
  });
});
mailSent.get("/:id", async (c) => {
  const denied = await requireMailSession(c);
  if (denied) return denied;
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const message = await getMailMessage(c.env.INBOUND, "sent", domain, c.req.param("id"));
  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }
  return c.json({
    message: {
      key: message.id,
      fromEmail: message.fromEmail,
      fromName: message.fromName ?? null,
      toEmail: message.toEmail,
      toEmails: message.toEmails?.length ? message.toEmails : [message.toEmail],
      ccEmails: message.ccEmails ?? [],
      subject: message.subject,
      sentAt: message.receivedAt,
      bodyPreview: message.bodyPreview,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      messageId: message.messageId,
      inReplyTo: message.inReplyTo ?? null,
      references: message.references ?? null,
      size: message.size,
      attachments: message.attachments
    }
  });
});

// src/lib/mobile-auth.ts
init_app();
async function requireMobilePassword(c) {
  const email = c.req.header("X-Account-Email")?.trim().toLowerCase();
  if (!email) {
    return c.json({ error: "Account email is required" }, 401);
  }
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const config = await getAccountMobileConfig2(createAppDb(c.env.RELAYBASE_DB), email);
  if (!config) {
    return c.json({ error: "Mobile access is not configured for this account" }, 401);
  }
  const candidateHash = await hashMobilePassword(token, config.salt);
  if (!constantTimeEqual(candidateHash, config.passwordHash)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return { email, config };
}
__name(requireMobilePassword, "requireMobilePassword");

// src/routes/mobile.ts
init_app();
init_catalog_store();

// src/lib/mail/list-inbox.ts
init_app();
init_inbound_events2();
init_messages();
function rowToInboundMeta2(row) {
  return {
    id: row.id,
    domain: row.domain,
    fromEmail: row.from_email,
    fromName: row.from_name ?? void 0,
    toEmail: row.to_email,
    toEmails: row.to_emails ? row.to_emails.split(",").filter(Boolean) : [],
    ccEmails: row.cc_emails ? row.cc_emails.split(",").filter(Boolean) : [],
    subject: row.subject,
    receivedAt: row.occurred_at,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.refs,
    size: row.size,
    bodyPreview: row.body_preview,
    bodyText: "",
    bodyHtml: null,
    attachments: Array.from({ length: row.attachment_count }, (_, i) => ({
      id: String(i),
      filename: "",
      contentType: "application/octet-stream",
      size: 0,
      disposition: "attachment",
      contentId: null
    })),
    readAt: row.read_at
  };
}
__name(rowToInboundMeta2, "rowToInboundMeta");
async function listInboxForDomains(env, domains2, options = {}) {
  const mailDb = createMailDb(env.RELAYBASE_MAIL);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const account = options.account?.trim().toLowerCase() || void 0;
  const collected = [];
  let total = 0;
  let unread = 0;
  for (const domain of domains2) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    if (!mailDb) continue;
    const page = await listMailboxPage(mailDb, {
      kind: "inbound",
      domain: normalized,
      account,
      limit
    });
    total += page.total;
    unread += page.unread;
    for (const row of page.rows) {
      collected.push(rowToInboundMeta2(row));
    }
  }
  collected.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return {
    messages: collected.slice(0, limit).map(serializeInboundListItem),
    total,
    unread
  };
}
__name(listInboxForDomains, "listInboxForDomains");
async function searchInboxForDomains(env, domains2, options) {
  const mailDb = createMailDb(env.RELAYBASE_MAIL);
  if (!mailDb) return null;
  return searchMailbox(mailDb, {
    kind: "inbound",
    domains: domains2,
    q: options.q,
    limit: options.limit,
    before: options.before,
    account: options.account
  });
}
__name(searchInboxForDomains, "searchInboxForDomains");
async function inboxCountsForDomains(env, domains2) {
  const mailDb = createMailDb(env.RELAYBASE_MAIL);
  const counts = {};
  let totalAll = 0;
  let unreadAll = 0;
  for (const domain of domains2) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized || !mailDb) continue;
    const byAddress = await mailboxAddressCounts(mailDb, "inbound", normalized);
    for (const [address, c] of Object.entries(byAddress)) {
      const bucket = counts[address] ?? { total: 0, unread: 0 };
      bucket.total += c.total;
      bucket.unread += c.unread;
      counts[address] = bucket;
      totalAll += c.total;
      unreadAll += c.unread;
    }
  }
  return { counts, totalAll, unreadAll };
}
__name(inboxCountsForDomains, "inboxCountsForDomains");
async function getInboxMessageForDomains(env, domains2, id) {
  for (const domain of domains2) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    const message = await getMailMessage(env.INBOUND, "inbound", normalized, id);
    if (message) return serializeInboundMessage(message);
  }
  return null;
}
__name(getInboxMessageForDomains, "getInboxMessageForDomains");
async function getInboxAttachmentResult(env, params) {
  return getInboundAttachment(env.INBOUND, params);
}
__name(getInboxAttachmentResult, "getInboxAttachmentResult");
async function setInboxReadStateMultiDomain(env, domains2, ids, read) {
  const readAt = read ? (/* @__PURE__ */ new Date()).toISOString() : null;
  const mailDb = createMailDb(env.RELAYBASE_MAIL);
  const updated = [];
  const idSet = new Set(ids.map((id) => id.trim()).filter(Boolean));
  if (idSet.size === 0) return { updated };
  for (const domain of domains2) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    if (idSet.size === 0) break;
    const resolved = [];
    for (const id of idSet) {
      const message = await getMailMessage(env.INBOUND, "inbound", normalized, id);
      if (message) resolved.push(id);
    }
    if (!resolved.length) continue;
    const result = await setMailReadState(
      env.INBOUND,
      normalized,
      resolved,
      readAt,
      mailDb
    );
    for (const id of result.updated) {
      updated.push(id);
      idSet.delete(id);
    }
  }
  return { updated };
}
__name(setInboxReadStateMultiDomain, "setInboxReadStateMultiDomain");
async function listInboxNotificationsForDomains(env, domains2, limit = 25) {
  const collected = [];
  for (const domain of domains2) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    const events = await listPendingEvents(createAppDb(env.RELAYBASE_DB), normalized, 100);
    collected.push(...events);
  }
  collected.sort((a, b) => b.data.receivedAt.localeCompare(a.data.receivedAt));
  return collected.slice(0, Math.min(Math.max(limit, 1), 100));
}
__name(listInboxNotificationsForDomains, "listInboxNotificationsForDomains");
async function ackInboxNotifications(env, domain, ids) {
  return ackPendingEvents(createAppDb(env.RELAYBASE_DB), domain, ids);
}
__name(ackInboxNotifications, "ackInboxNotifications");

// src/routes/mobile.ts
init_messages();
init_cloudflare_config();
var mobile = new Hono2();
mobile.use("*", async (c, next) => {
  const auth = await requireMobilePassword(c);
  if (auth instanceof Response) return auth;
  c.set("mobileAuth", auth);
  c.set("authEmail", auth.email);
  const data = await readMailbox2(createAppDb(c.env.RELAYBASE_DB));
  const allEnabled = mobileEnabledAddresses(data);
  const addresses2 = allEnabled.filter(
    (a) => a.email.toLowerCase() === auth.email
  );
  const domains2 = addresses2.map((a) => a.domain);
  c.set("mobileAddresses", addresses2);
  c.set("mobileDomains", domains2);
  await next();
});
mobile.get("/sending-health", async (c) => {
  const domains2 = c.get("mobileDomains");
  let cf = null;
  let probeError;
  try {
    cf = await createCloudflareClient(c.env);
  } catch (error) {
    probeError = error instanceof Error ? error.message : UNKNOWN_ERROR;
  }
  const snapshot = await collectSendingHealth(domains2, cf, {
    accountId: c.env.CF_ACCOUNT_ID,
    probeError
  });
  return c.json({
    ...snapshot,
    domains: snapshot.domains.map((domain) => ({
      ...domain,
      cloudflareSendingUrl: null
    }))
  });
});
mobile.get("/config", async (c) => {
  const email = c.get("authEmail");
  return c.json({ ok: true, mobile: true, email });
});
mobile.get("/profile", async (c) => {
  const addresses2 = c.get("mobileAddresses");
  const address = addresses2[0];
  return c.json({
    ok: true,
    email: c.get("authEmail"),
    displayName: address?.displayName ?? "",
    signature: address?.signature ?? ""
  });
});
mobile.patch("/profile", async (c) => {
  const email = c.get("authEmail");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const patch = {};
  if (body.displayName !== void 0) {
    if (typeof body.displayName !== "string") {
      return c.json({ error: "displayName must be a string" }, 400);
    }
    const trimmed = body.displayName.trim();
    if (trimmed.length > 128) {
      return c.json({ error: "displayName must be 128 characters or fewer" }, 400);
    }
    patch.displayName = trimmed;
  }
  if (body.signature !== void 0) {
    if (typeof body.signature !== "string") {
      return c.json({ error: "signature must be a string" }, 400);
    }
    if (body.signature.length > 1024) {
      return c.json({ error: "signature must be 1024 characters or fewer" }, 400);
    }
    patch.signature = body.signature;
  }
  const updated = await updateAddressProfile2(
    createAppDb(c.env.RELAYBASE_DB),
    email,
    patch
  );
  if (!updated) {
    return c.json({ error: "Account not found" }, 404);
  }
  return c.json({
    ok: true,
    email: updated.email,
    displayName: updated.displayName ?? "",
    signature: updated.signature ?? ""
  });
});
mobile.get("/mailbox", async (c) => {
  const addresses2 = c.get("mobileAddresses");
  const domains2 = c.get("mobileDomains");
  return c.json({
    domains: domains2,
    addresses: addresses2.map((a) => ({
      email: a.email,
      domain: a.domain,
      displayName: a.displayName ?? null,
      inboundEnabled: a.inboundEnabled !== false
    }))
  });
});
mobile.get("/inbox", async (c) => {
  const domains2 = c.get("mobileDomains");
  const authEmail = c.get("authEmail");
  const account = c.req.query("account")?.trim().toLowerCase() || authEmail || void 0;
  const limit = Number(c.req.query("limit") ?? "50");
  const page = await listInboxForDomains(c.env, domains2, {
    account,
    limit: Number.isFinite(limit) ? limit : 50
  });
  return c.json({
    messages: page.messages,
    total: page.total,
    unread: page.unread
  });
});
mobile.get("/inbox/search", async (c) => {
  const domains2 = c.get("mobileDomains");
  const authEmail = c.get("authEmail");
  const q = c.req.query("q")?.trim() ?? "";
  if (q.length < MIN_SEARCH_QUERY_LENGTH) {
    return c.json(
      { error: `q must be at least ${MIN_SEARCH_QUERY_LENGTH} characters` },
      400
    );
  }
  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || void 0;
  const page = await searchInboxForDomains(c.env, domains2, {
    q,
    limit: Number.isFinite(limit) ? limit : 50,
    before,
    account: authEmail
  });
  if (!page) {
    return c.json({ error: "Search index is not configured" }, 503);
  }
  return c.json({
    messages: page.rows.map(
      (row) => serializeInboundListItem(rowToInboundMeta3(row))
    ),
    total: page.total,
    nextBefore: page.nextBefore,
    hasMore: page.hasMore
  });
});
function rowToInboundMeta3(row) {
  return {
    id: row.id,
    domain: row.domain,
    fromEmail: row.from_email,
    fromName: row.from_name ?? void 0,
    toEmail: row.to_email,
    toEmails: row.to_emails ? row.to_emails.split(",").filter(Boolean) : [],
    ccEmails: row.cc_emails ? row.cc_emails.split(",").filter(Boolean) : [],
    subject: row.subject,
    receivedAt: row.occurred_at,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.refs,
    size: row.size,
    bodyPreview: row.body_preview,
    bodyText: "",
    bodyHtml: null,
    attachments: Array.from({ length: row.attachment_count }, (_, i) => ({
      id: String(i),
      filename: "",
      contentType: "application/octet-stream",
      size: 0,
      disposition: "attachment",
      contentId: null
    })),
    readAt: row.read_at
  };
}
__name(rowToInboundMeta3, "rowToInboundMeta");
mobile.get("/inbox/counts", async (c) => {
  const domains2 = c.get("mobileDomains");
  const counts = await inboxCountsForDomains(c.env, domains2);
  return c.json(counts);
});
mobile.post("/inbox/read", async (c) => {
  const domains2 = c.get("mobileDomains");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  if (typeof body.read !== "boolean") {
    return c.json({ error: "read must be a boolean" }, 400);
  }
  const result = await setInboxReadStateMultiDomain(c.env, domains2, ids, body.read);
  return c.json(result);
});
mobile.get("/inbox/:id", async (c) => {
  const domains2 = c.get("mobileDomains");
  const domainHint = c.req.query("domain")?.trim().toLowerCase();
  const lookupDomains = domainHint ? [domainHint] : domains2;
  const message = await getInboxMessageForDomains(
    c.env,
    lookupDomains,
    c.req.param("id")
  );
  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }
  return c.json({ message });
});
mobile.get("/inbox/:id/attachments/:attachmentId", async (c) => {
  const domains2 = c.get("mobileDomains");
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain || !domains2.includes(domain)) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const result = await getInboxAttachmentResult(c.env, {
    domain,
    messageId: c.req.param("id"),
    attachmentId: c.req.param("attachmentId")
  });
  if (!result) {
    return c.json({ error: "Attachment not found" }, 404);
  }
  const encoded = encodeURIComponent(result.meta.filename);
  return new Response(result.body, {
    headers: {
      "Content-Type": result.meta.contentType,
      "Content-Disposition": `${result.meta.disposition === "inline" ? "inline" : "attachment"}; filename="${result.meta.filename}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, max-age=3600"
    }
  });
});
mobile.get("/sent", async (c) => {
  const domains2 = c.get("mobileDomains");
  const authEmail = c.get("authEmail");
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index is not configured" }, 503);
  }
  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || void 0;
  const collected = [];
  let total = 0;
  for (const domain of domains2) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    const page = await listMailboxPage(mailDb, {
      kind: "sent",
      domain: normalized,
      account: authEmail,
      limit: Number.isFinite(limit) ? limit : 50,
      before
    });
    total += page.total;
    for (const row of page.rows) collected.push(rowToSentItem2(row));
  }
  collected.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const sliced = collected.slice(0, Number.isFinite(limit) ? limit : 50);
  return c.json({
    sent: sliced,
    total,
    hasMore: total > sliced.length
  });
});
function rowToSentItem2(row) {
  return {
    id: row.id,
    from: row.from_email,
    fromName: row.from_name ?? null,
    to: row.to_emails ?? row.to_email,
    cc: row.cc_emails ?? "",
    subject: row.subject,
    bodyPreview: row.body_preview,
    sentAt: row.occurred_at,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.refs,
    size: row.size,
    attachmentCount: row.attachment_count
  };
}
__name(rowToSentItem2, "rowToSentItem");
mobile.post("/send", async (c) => {
  const addresses2 = c.get("mobileAddresses");
  const allowedFrom = new Set(addresses2.map((a) => a.email.toLowerCase()));
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const from = body.from?.trim().toLowerCase();
  if (!from || !allowedFrom.has(from)) {
    return c.json(
      { error: "From address is not enabled for mobile access" },
      403
    );
  }
  const result = await sendMailMessage(c.env, body, "mobile", {
    waitUntil: /* @__PURE__ */ __name((promise) => c.executionCtx.waitUntil(promise), "waitUntil")
  });
  return result.response;
});
mobile.get("/notifications", async (c) => {
  const domains2 = c.get("mobileDomains");
  const limit = Number(c.req.query("limit") ?? "25");
  const events = await listInboxNotificationsForDomains(
    c.env,
    domains2,
    Number.isFinite(limit) ? limit : 25
  );
  return c.json({ events });
});
mobile.post("/notifications/ack", async (c) => {
  const domains2 = c.get("mobileDomains");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = body.domain?.trim().toLowerCase();
  if (!domain || !domains2.includes(domain)) {
    return c.json({ error: "domain is required" }, 400);
  }
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  const acked = await ackInboxNotifications(c.env, domain, ids);
  return c.json({ acked });
});

// src/routes/send.ts
init_cloudflare_api_hints();
init_email_send();
init_ops_logs();
init_send_logs();
init_mime();
var send = new Hono2();
function keyFields(record) {
  return {
    domain: record?.domain ?? null,
    keyId: record?.id ?? null,
    keyPrefix: record?.keyPrefix ?? null,
    keyLabel: record?.label ?? null
  };
}
__name(keyFields, "keyFields");
async function logAndRespond(c, params) {
  const fields = keyFields(params.record ?? null);
  try {
    await recordSendLog(c.env.INBOUND, {
      ok: params.ok,
      status: params.status,
      ...fields,
      from: params.from ?? null,
      to: params.to ?? null,
      subject: params.subject ?? null,
      messageId: params.messageId,
      error: params.error
    });
  } catch (error) {
    console.error("Failed to record send log", error);
  }
  try {
    await recordOpsLog(c.env.RELAYBASE_LOGS, {
      kind: "send",
      ok: params.opsOk ?? params.ok,
      status: params.status,
      source: "api",
      domain: fields.domain,
      fromAddr: params.from ?? null,
      toAddr: params.to ?? null,
      subject: params.subject ?? null,
      messageId: params.messageId ?? null,
      error: params.error ?? null,
      keyId: fields.keyId,
      keyPrefix: fields.keyPrefix,
      metaJson: params.metaJson ?? null
    });
  } catch (error) {
    console.error("Failed to record ops log", error);
  }
  return c.json(params.body, params.status);
}
__name(logAndRespond, "logAndRespond");
send.post("/", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) {
    try {
      await recordSendLog(c.env.INBOUND, {
        ok: false,
        status: 401,
        domain: null,
        keyId: null,
        keyPrefix: null,
        keyLabel: null,
        from: null,
        to: null,
        subject: null,
        error: "Invalid or missing API key"
      });
    } catch (error) {
      console.error("Failed to record send log", error);
    }
    try {
      await recordOpsLog(c.env.RELAYBASE_LOGS, {
        kind: "api_error",
        ok: false,
        status: 401,
        source: "api",
        error: "Invalid or missing API key"
      });
    } catch (error) {
      console.error("Failed to record ops log", error);
    }
    return auth;
  }
  const { record } = auth;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return logAndRespond(c, {
      ok: false,
      status: 400,
      body: { error: "Invalid JSON body" },
      record,
      error: "Invalid JSON body"
    });
  }
  const from = body.from?.trim();
  const to = normalizeRecipients(body.to);
  const cc = normalizeRecipients(body.cc);
  const subject = body.subject?.trim();
  const text2 = body.text?.trim();
  if (!from || !to.length || !subject || !text2) {
    return logAndRespond(c, {
      ok: false,
      status: 400,
      body: { error: "from, to, subject, and text are required" },
      record,
      from: from ?? null,
      to: to.join(", ") || null,
      subject: subject ?? null,
      error: "from, to, subject, and text are required"
    });
  }
  const invalid = [
    ...findInvalidRecipients(to),
    ...findInvalidRecipients(cc)
  ];
  if (invalid.length) {
    return logAndRespond(c, {
      ok: false,
      status: 400,
      body: { error: `Invalid email address: ${invalid.join(", ")}` },
      record,
      from,
      to: to.join(", "),
      subject,
      error: `Invalid email address: ${invalid.join(", ")}`
    });
  }
  if (!emailMatchesDomain(from, record.domain)) {
    return logAndRespond(c, {
      ok: false,
      status: 403,
      body: { error: `From address must be on ${record.domain}` },
      record,
      from,
      to: to.join(", "),
      subject,
      error: `From address must be on ${record.domain}`
    });
  }
  try {
    const result = await sendOutboundEmail(c.env, {
      from,
      fromName: body.fromName?.trim() || void 0,
      to: to.length === 1 ? to[0] : to,
      cc: cc.length ? cc.length === 1 ? cc[0] : cc : void 0,
      subject,
      text: text2,
      html: body.html,
      replyTo: body.replyTo,
      inReplyTo: body.inReplyTo?.trim() || void 0,
      references: body.references?.trim() || void 0
    });
    const hadBounces = result.permanentBounces.length > 0;
    const meta = JSON.stringify({
      delivered: result.delivered,
      queued: result.queued,
      ...hadBounces ? { permanentBounces: result.permanentBounces } : {}
    });
    if (result.delivered.length === 0 && result.queued.length === 0 && hadBounces) {
      const error = `All recipients permanently bounced: ${result.permanentBounces.join(", ")}`;
      return logAndRespond(c, {
        ok: false,
        status: 502,
        body: { error, messageId: result.messageId },
        record,
        from,
        to: to.join(", "),
        subject,
        messageId: result.messageId,
        error,
        metaJson: meta
      });
    }
    const rawMime = buildMimeMessage({
      from,
      fromName: body.fromName?.trim() || void 0,
      to: to.length === 1 ? to[0] : to,
      cc: cc.length ? cc : void 0,
      subject,
      text: text2,
      html: body.html,
      replyTo: body.replyTo,
      messageId: result.messageId,
      inReplyTo: body.inReplyTo?.trim() || void 0,
      references: body.references?.trim() || void 0
    });
    try {
      await storeSentMail(
        c.env.INBOUND,
        {
          from,
          fromName: body.fromName?.trim() || void 0,
          to,
          cc: cc.length ? cc : void 0,
          subject,
          text: text2,
          html: body.html,
          messageId: result.messageId,
          inReplyTo: body.inReplyTo?.trim() || null,
          references: body.references?.trim() || null,
          rawMime
        },
        createMailDb(c.env.RELAYBASE_MAIL)
      );
    } catch (error) {
      console.error("Failed to persist sent mail", error);
    }
    await deliverToLocalInboxes(c.env, {
      from,
      to,
      cc: cc.length ? cc : void 0,
      subject,
      messageId: result.messageId,
      inReplyTo: body.inReplyTo?.trim() || null,
      references: body.references?.trim() || null,
      rawMime,
      skipAddresses: result.permanentBounces,
      waitUntil: /* @__PURE__ */ __name((promise) => c.executionCtx.waitUntil(promise), "waitUntil")
    });
    return logAndRespond(c, {
      ok: true,
      opsOk: !hadBounces,
      status: 200,
      body: { messageId: result.messageId },
      record,
      from,
      to: to.join(", "),
      subject,
      messageId: result.messageId,
      error: hadBounces ? `Some recipients permanently bounced: ${result.permanentBounces.join(", ")}` : void 0,
      metaJson: meta
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    return logAndRespond(c, {
      ok: false,
      status: 502,
      body: cloudflareSendErrorBody(message),
      record,
      from,
      to: to.join(", "),
      subject,
      error: message
    });
  }
});

// src/routes/v1-inbox.ts
init_app();
init_inbound_events2();
init_messages();
var v1Inbox = new Hono2();
v1Inbox.get("/events", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const limit = Number(c.req.query("limit") ?? "25");
  const events = await listPendingEvents(createAppDb(c.env.RELAYBASE_DB), auth.record.domain, limit);
  return c.json({ events });
});
v1Inbox.post("/events/ack", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  const acked = await ackPendingEvents(createAppDb(c.env.RELAYBASE_DB), auth.record.domain, ids);
  return c.json({ acked });
});
function rowToInboundMeta4(row) {
  return {
    id: row.id,
    domain: row.domain,
    fromEmail: row.from_email,
    fromName: row.from_name ?? void 0,
    toEmail: row.to_email,
    toEmails: row.to_emails ? row.to_emails.split(",").filter(Boolean) : [],
    ccEmails: row.cc_emails ? row.cc_emails.split(",").filter(Boolean) : [],
    subject: row.subject,
    receivedAt: row.occurred_at,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: row.refs,
    size: row.size,
    bodyPreview: row.body_preview,
    bodyText: "",
    bodyHtml: null,
    attachments: Array.from({ length: row.attachment_count }, (_, i) => ({
      id: String(i),
      filename: "",
      contentType: "application/octet-stream",
      size: 0,
      disposition: "attachment",
      contentId: null
    })),
    readAt: row.read_at
  };
}
__name(rowToInboundMeta4, "rowToInboundMeta");
v1Inbox.get("/messages", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index is not configured" }, 503);
  }
  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || void 0;
  const page = await listMailboxPage(mailDb, {
    kind: "inbound",
    domain: auth.record.domain,
    limit: Number.isFinite(limit) ? limit : 50,
    before
  });
  return c.json({
    messages: page.rows.map(
      (row) => serializeInboundListItem(rowToInboundMeta4(row))
    ),
    nextBefore: page.nextBefore,
    hasMore: page.hasMore,
    total: page.total,
    unread: page.unread
  });
});
v1Inbox.get("/messages/counts", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index is not configured" }, 503);
  }
  const byAddress = await mailboxAddressCounts(mailDb, "inbound", auth.record.domain);
  let totalAll = 0;
  let unreadAll = 0;
  const counts = {};
  for (const [address, value] of Object.entries(byAddress)) {
    counts[address] = value;
    totalAll += value.total;
    unreadAll += value.unread;
  }
  return c.json({ counts, totalAll, unreadAll });
});
v1Inbox.get("/messages/search", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const q = c.req.query("q")?.trim() ?? "";
  if (q.length < MIN_SEARCH_QUERY_LENGTH) {
    return c.json(
      { error: `q must be at least ${MIN_SEARCH_QUERY_LENGTH} characters` },
      400
    );
  }
  const mailDb = createMailDb(c.env.RELAYBASE_MAIL);
  if (!mailDb) {
    return c.json({ error: "Mail index is not configured" }, 503);
  }
  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || void 0;
  const page = await searchMailbox(mailDb, {
    kind: "inbound",
    domains: [auth.record.domain],
    q,
    limit: Number.isFinite(limit) ? limit : 50,
    before
  });
  return c.json({
    messages: page.rows.map(
      (row) => serializeInboundListItem(rowToInboundMeta4(row))
    ),
    total: page.total,
    nextBefore: page.nextBefore,
    hasMore: page.hasMore
  });
});
v1Inbox.post("/messages/read", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  if (typeof body.read !== "boolean") {
    return c.json({ error: "read must be a boolean" }, 400);
  }
  const readAt = body.read ? (/* @__PURE__ */ new Date()).toISOString() : null;
  const result = await setMailReadState(
    c.env.INBOUND,
    auth.record.domain,
    ids,
    readAt,
    createMailDb(c.env.RELAYBASE_MAIL)
  );
  return c.json(result);
});
v1Inbox.get("/messages/:id/attachments/:attachmentId", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const result = await getInboundAttachment(c.env.INBOUND, {
    domain: auth.record.domain,
    messageId: c.req.param("id"),
    attachmentId: c.req.param("attachmentId")
  });
  if (!result) {
    return c.json({ error: "Attachment not found" }, 404);
  }
  const encoded = encodeURIComponent(result.meta.filename);
  return new Response(result.body, {
    headers: {
      "Content-Type": result.meta.contentType,
      "Content-Disposition": `${result.meta.disposition === "inline" ? "inline" : "attachment"}; filename="${result.meta.filename}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, max-age=3600"
    }
  });
});
v1Inbox.get("/messages/:id", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const message = await getMailMessage(
    c.env.INBOUND,
    "inbound",
    auth.record.domain,
    c.req.param("id")
  );
  if (!message || message.domain !== auth.record.domain) {
    return c.json({ error: "Message not found" }, 404);
  }
  return c.json({ message: serializeInboundMessage(message) });
});

// src/routes/v1-webhooks.ts
init_app();
var v1Webhooks = new Hono2();
v1Webhooks.post("/", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const url = body.url?.trim();
  if (!url) {
    return c.json({ error: "url is required" }, 400);
  }
  try {
    const result = await createWebhook(createAppDb(c.env.RELAYBASE_DB), {
      domain: auth.record.domain,
      url,
      secret: body.secret
    });
    return c.json(
      {
        webhook: result.webhook,
        secret: result.secret
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create webhook";
    return c.json({ error: message }, 400);
  }
});
v1Webhooks.get("/", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const webhooks2 = await listWebhooks2(createAppDb(c.env.RELAYBASE_DB), auth.record.domain);
  return c.json({ webhooks: webhooks2 });
});
v1Webhooks.delete("/:id", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;
  const deleted = await deleteWebhook(
    createAppDb(c.env.RELAYBASE_DB),
    auth.record.domain,
    c.req.param("id")
  );
  if (!deleted) {
    return c.json({ error: "Webhook not found" }, 404);
  }
  return c.json({ ok: true });
});

// src/app.ts
var app = new Hono2();
async function checkInboundR22(bucket) {
  try {
    await bucket.list({ limit: 1 });
    return true;
  } catch (error) {
    console.error("Inbound R2 check failed", error);
    return false;
  }
}
__name(checkInboundR22, "checkInboundR2");
app.use("*", desktopCors);
app.get("/health", async (c) => {
  const [r2Configured, d1] = await Promise.all([
    checkInboundR22(c.env.INBOUND),
    probeD1Connection(
      c.env.RELAYBASE_LOGS,
      c.env.RELAYBASE_MAIL,
      c.env.RELAYBASE_DB,
      c.env.CF_ACCOUNT_ID,
      c.env.CF_API_TOKEN
    )
  ]);
  return c.json({
    ok: true,
    version: c.env.WORKER_VERSION?.trim() || "unknown",
    inbound: {
      r2Configured,
      bucketName: c.env.INBOUND_BUCKET_NAME
    },
    d1,
    // Binding present ≠ schema ready. `configured` is table-ready.
    d1Bound: {
      logs: Boolean(c.env.RELAYBASE_LOGS),
      mail: Boolean(c.env.RELAYBASE_MAIL),
      // Legacy alias for desktop clients still reading the old name.
      inboxIndex: Boolean(c.env.RELAYBASE_MAIL),
      app: Boolean(c.env.RELAYBASE_DB)
    },
    // Proves this isolate has ledger catch-up (stamp baseline, skip already-exists).
    schemaMigrate: "reconcile-v1"
  });
});
app.route("/console/keys", consoleKeys);
app.route("/console/ops-logs", consoleOpsLogs);
app.route("/console/send-logs", consoleSendLogs);
app.route("/console/branding", consoleBranding);
app.route("/console/connect", consoleConnect);
app.route("/console/init-db", consoleInitDb);
app.route("/console/migrate-db", consoleMigrateDb);
app.route("/console/register-owner", consoleRegisterOwner);
app.route("/console", consoleOwnerAuth);
app.route("/console/mailbox", consoleMailbox);
app.route("/console/domains", consoleDomains);
app.route("/console/zones", consoleZones);
app.route("/console/sending-onboard", consoleSendingOnboard);
app.route("/console/addresses", consoleAddresses);
app.route("/console/audience-groups", consoleAudienceGroups);
app.route("/console/broadcasts", consoleBroadcasts);
app.route("/console/stats", consoleStats);
app.route("/console/rebuild-mail", consoleRebuildMail);
app.route("/console/mailbox-health", consoleMailboxHealth);
app.route("/console/settings", consoleSettings);
app.route("/mail/addresses", mailAddresses);
app.route("/mail/sending-health", mailSendingHealth);
app.route("/mail/inbox", mailInbox);
app.route("/mail/send", mailSend);
app.route("/mail/sent", mailSent);
app.route("/mail/favicon", mailFavicon);
app.route("/mobile", mobile);
app.route("/v1/inbox", v1Inbox);
app.route("/v1/webhooks", v1Webhooks);
app.route("/v1/send", send);
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  const detail = err instanceof Error ? err.message : String(err);
  return c.json({ error: "Internal server error", detail }, 500);
});
var app_default = app;

// src/inbound.ts
init_ops_logs();
async function handleInboundEmail(message, env) {
  const raw2 = await new Response(message.raw).arrayBuffer();
  const result = await storeInboundMail(
    env.INBOUND,
    {
      envelopeFrom: message.from,
      toEmail: message.to,
      subject: message.headers.get("subject")?.trim() || "(no subject)",
      messageId: message.headers.get("message-id")?.trim() || null,
      inReplyTo: message.headers.get("in-reply-to")?.trim() || null,
      references: message.headers.get("references")?.trim() || null,
      size: message.rawSize,
      raw: raw2
    },
    createMailDb(env.RELAYBASE_MAIL)
  );
  await recordOpsLog(env.RELAYBASE_LOGS, {
    kind: "inbound",
    ok: true,
    source: "inbound",
    domain: result.record.domain,
    fromAddr: message.from,
    toAddr: message.to,
    subject: result.record.subject,
    messageId: result.record.messageId,
    metaJson: JSON.stringify({
      inboundId: result.record.id,
      created: result.created
    })
  });
  if (isBounceMessage(raw2, message.from)) {
    const diagnostic = parseBounceDiagnostic(raw2);
    const error = buildBouncePreview(diagnostic, "Bounce: delivery failed");
    await recordOpsLog(env.RELAYBASE_LOGS, {
      kind: "bounce",
      ok: false,
      source: "inbound",
      domain: result.record.domain,
      fromAddr: message.from,
      toAddr: diagnostic.finalRecipient ?? message.to,
      subject: result.record.subject,
      messageId: result.record.messageId,
      error,
      metaJson: JSON.stringify({
        inboundId: result.record.id,
        dsnStatus: diagnostic.status,
        diagnosticCode: diagnostic.diagnosticCode
      })
    });
  }
  return result;
}
__name(handleInboundEmail, "handleInboundEmail");

// src/index.ts
init_catalog_audience();

// src/lib/inbound-index-cron.ts
init_app();
init_catalog_store();
init_messages();
init_messages();
async function runInboundIndexCron(env) {
  if (!env.INBOUND) return;
  const mailDb = createMailDb(env.RELAYBASE_MAIL);
  if (!mailDb) return;
  const appDb = createAppDb(env.RELAYBASE_DB);
  const mailbox = await readMailbox2(appDb);
  for (const domainEntry of mailbox.domains) {
    const domain = domainEntry.trim().toLowerCase();
    if (!domain) continue;
    for (const kind of ["inbound", "sent"]) {
      try {
        await reconcileDomain(env, mailDb, kind, domain);
      } catch (error) {
        console.error(
          `Mailbox index verify failed for ${kind}/${domain}`,
          error
        );
      }
    }
  }
  const retain = (await getAppSettings(appDb)).inboundRetainPerDomain;
  if (retain == null) return;
  for (const domainEntry of mailbox.domains) {
    const domain = domainEntry.trim().toLowerCase();
    if (!domain) continue;
    try {
      await pruneMail(env.INBOUND, mailDb, "inbound", domain, retain);
    } catch (error) {
      console.error(`Mailbox inbound prune failed for ${domain}`, error);
    }
  }
}
__name(runInboundIndexCron, "runInboundIndexCron");
async function reconcileDomain(env, mailDb, kind, domain) {
  if (!mailDb) return;
  const folderIds = await listMessageFolderIds(env.INBOUND, kind, domain);
  if (folderIds.length === 0) return;
  const d1Ids = await listD1IdsForDomain(mailDb, kind, domain);
  const d1Set = new Set(d1Ids);
  const missing = folderIds.filter((id) => !d1Set.has(id));
  const stale = d1Ids.filter((id) => !folderIds.includes(id));
  for (const id of missing) {
    const thin = await loadThinMeta(env.INBOUND, kind, domain, id);
    if (!thin) continue;
    try {
      await upsertMailboxMessage(mailDb, {
        id: thin.id,
        kind: thin.kind,
        domain: thin.domain,
        from_email: thin.fromEmail,
        from_name: thin.fromName ?? null,
        to_email: thin.toEmail,
        to_emails: (thin.toEmails ?? []).join(","),
        cc_emails: (thin.ccEmails ?? []).join(","),
        recipients: recipientsColumn2(thin),
        subject: thin.subject,
        body_preview: thin.bodyPreview,
        occurred_at: thin.occurredAt,
        message_id: thin.messageId,
        in_reply_to: thin.inReplyTo,
        refs: thin.references,
        size: thin.size,
        attachment_count: thin.attachments?.length ?? 0,
        read_at: thin.readAt ?? null,
        r2_prefix: `${kind}/${domain}/${id}`
      });
    } catch (error) {
      console.error(`Mailbox cron upsert failed ${kind}/${domain}/${id}`, error);
    }
  }
  if (stale.length > 0) {
    try {
      const { deleteMailboxMessages: deleteMailboxMessages2 } = await Promise.resolve().then(() => (init_messages(), messages_exports));
      await deleteMailboxMessages2(mailDb, stale);
    } catch (error) {
      console.error(`Mailbox cron prune failed ${kind}/${domain}`, error);
    }
  }
}
__name(reconcileDomain, "reconcileDomain");
function recipientsColumn2(thin) {
  const addresses2 = /* @__PURE__ */ new Set();
  const add = /* @__PURE__ */ __name((value) => {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) addresses2.add(trimmed);
  }, "add");
  add(thin.toEmail);
  for (const to of thin.toEmails ?? []) add(to);
  for (const cc of thin.ccEmails ?? []) add(cc);
  return [...addresses2].join(",");
}
__name(recipientsColumn2, "recipientsColumn");
async function listD1IdsForDomain(mailDb, kind, domain) {
  const raw2 = mailDb.$client;
  const result = await raw2.prepare(
    `SELECT id FROM mailbox_messages WHERE kind = ? AND domain = ?`
  ).bind(kind, domain).all();
  return (result.results ?? []).map((row) => row.id);
}
__name(listD1IdsForDomain, "listD1IdsForDomain");

// src/index.ts
init_inbound_events2();
init_ops_logs();
init_app();
async function dispatchInboundEvent(db, record) {
  const event = await enqueueInboundEvent(db, record);
  await deliverWebhooks(db, record.domain, event);
}
__name(dispatchInboundEvent, "dispatchInboundEvent");
var index_default = {
  fetch: app_default.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runAudienceCron(createAppDb(env.RELAYBASE_DB)).catch((error) => {
        console.error("Audience cron failed", error);
      })
    );
    ctx.waitUntil(
      runInboundIndexCron(env).catch((error) => {
        console.error("Inbound index cron failed", error);
      })
    );
  },
  async email(message, env, ctx) {
    try {
      const { record, created } = await handleInboundEmail(message, env);
      if (created) {
        ctx.waitUntil(dispatchInboundEvent(createAppDb(env.RELAYBASE_DB), record));
      }
    } catch (error) {
      console.error("Failed to store inbound email", error);
      const to = message.to;
      const domain = to.includes("@") ? to.slice(to.lastIndexOf("@") + 1).trim().toLowerCase() : null;
      await recordOpsLog(env.RELAYBASE_LOGS, {
        kind: "inbound",
        ok: false,
        source: "inbound",
        domain,
        fromAddr: message.from,
        toAddr: to,
        subject: message.headers.get("subject")?.trim() || null,
        messageId: message.headers.get("message-id")?.trim() || null,
        error: error instanceof Error ? error.message : "Failed to store inbound email"
      });
      throw error;
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
